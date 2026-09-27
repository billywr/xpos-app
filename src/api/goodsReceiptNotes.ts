import { getDatabase, withTransaction } from "@/db/database";
import type { PageResponse } from "@/types";

export interface GrnLineResponse {
  id: string;
  grnId: string;
  itemId: string;
  itemName: string;
  barcode?: string | null;
  qty: number;
  uomId: string | null;
  receivedUnitCost: number | null;
  createdAt: string;
}

export interface GoodsReceiptNoteResponse {
  id: string;
  orgId: string;
  branchId: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderId: string | null;
  receivedByStaffUserId: string;
  receivedAt: string;
  createdAt: string;
  active: boolean;
  lines: GrnLineResponse[];
}

export interface GrnLineRequest {
  itemId: string;
  qty: number;
  receivedUnitCost?: number | null;
}

export interface GrnUpdateBody {
  supplierId: string;
  receivedAt: string;
  active?: boolean;
  lines?: GrnLineRequest[];
}

export interface CreateGrnBody {
  branchId: string;
  supplierId: string;
  purchaseOrderId?: string | null;
  lines: GrnLineRequest[];
}

export async function fetchGoodsReceiptNotes(
  _token: string | null,
  _orgId: string,
  _branchId: string,
  params?: { page?: number; size?: number; includeInactive?: boolean }
): Promise<PageResponse<GoodsReceiptNoteResponse>> {
  const db = await getDatabase();
  const page = params?.page ?? 0;
  const size = params?.size ?? 100;
  const offset = page * size;

  const grnRows = await db.getAllAsync<any>(
    `SELECT 
      g.id,
      'offline-org' as orgId,
      'offline-branch' as branchId,
      g.supplier_id as supplierId,
      COALESCE(s.name, 'Unknown Supplier') as supplierName,
      NULL as purchaseOrderId,
      'offline-user' as receivedByStaffUserId,
      g.received_at as receivedAt,
      g.created_at as createdAt,
      CASE WHEN g.status = 'COMPLETED' THEN 1 ELSE 0 END as active
    FROM goods_receipt_notes g
    LEFT JOIN suppliers s ON g.supplier_id = s.id
    ORDER BY g.received_at DESC, g.created_at DESC
    LIMIT ? OFFSET ?`,
    [size, offset]
  );

  const countRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM goods_receipt_notes`
  );
  const totalElements = countRow?.count ?? 0;
  const totalPages = Math.ceil(totalElements / size);

  const content: GoodsReceiptNoteResponse[] = [];

  for (const grn of grnRows) {
    const lines = await db.getAllAsync<any>(
      `SELECT 
        gl.id,
        gl.grn_id as grnId,
        gl.item_id as itemId,
        i.name as itemName,
        i.barcode,
        gl.quantity as qty,
        NULL as uomId,
        gl.unit_cost as receivedUnitCost,
        grn.created_at as createdAt
      FROM grn_lines gl
      JOIN goods_receipt_notes grn ON gl.grn_id = grn.id
      JOIN items i ON gl.item_id = i.id
      WHERE gl.grn_id = ?`,
      [grn.id]
    );

    content.push({
      ...grn,
      active: Boolean(grn.active),
      lines: lines.map((l) => ({
        id: l.id,
        grnId: l.grnId,
        itemId: l.itemId,
        itemName: l.itemName,
        barcode: l.barcode,
        qty: l.qty,
        uomId: null,
        receivedUnitCost: l.receivedUnitCost,
        createdAt: l.createdAt,
      })),
    });
  }

  return {
    content,
    totalElements,
    totalPages,
    size,
    number: page,
    first: page === 0,
    last: page >= totalPages - 1,
    empty: content.length === 0,
  };
}

export async function createGoodsReceiptNote(
  _token: string | null,
  _orgId: string,
  body: CreateGrnBody
): Promise<GoodsReceiptNoteResponse> {
  return await withTransaction(async (db) => {
    const grnId = "grn-" + Date.now();
    const grnNumber = "GRN-" + Date.now().toString().slice(-6);
    const now = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO goods_receipt_notes (id, grn_number, supplier_id, status, received_at, created_at)
       VALUES (?, ?, ?, 'COMPLETED', ?, ?)`,
      [grnId, grnNumber, body.supplierId, now, now]
    );

    const createdLines: GrnLineResponse[] = [];

    for (const line of body.lines) {
      const lineId = "grnl-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
      const unitCost = line.receivedUnitCost ?? 0;
      const totalCost = line.qty * unitCost;

      await db.runAsync(
        `INSERT INTO grn_lines (id, grn_id, item_id, quantity, unit_cost, total_cost)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [lineId, grnId, line.itemId, line.qty, unitCost, totalCost]
      );

      // Replenish stock on hand in items table
      await db.runAsync(
        `UPDATE items 
         SET current_stock = current_stock + ?,
             cost_price = CASE WHEN ? > 0 THEN ? ELSE cost_price END,
             updated_at = ?
         WHERE id = ?`,
        [line.qty, unitCost, unitCost, now, line.itemId]
      );

      const item = await db.getFirstAsync<{ name: string; barcode: string | null }>(
        `SELECT name, barcode FROM items WHERE id = ?`,
        [line.itemId]
      );

      createdLines.push({
        id: lineId,
        grnId,
        itemId: line.itemId,
        itemName: item?.name ?? "Item",
        barcode: item?.barcode,
        qty: line.qty,
        uomId: null,
        receivedUnitCost: unitCost,
        createdAt: now,
      });
    }

    const supplier = await db.getFirstAsync<{ name: string }>(
      `SELECT name FROM suppliers WHERE id = ?`,
      [body.supplierId]
    );

    return {
      id: grnId,
      orgId: "offline-org",
      branchId: "offline-branch",
      supplierId: body.supplierId,
      supplierName: supplier?.name ?? "Supplier",
      purchaseOrderId: null,
      receivedByStaffUserId: "offline-user",
      receivedAt: now,
      createdAt: now,
      active: true,
      lines: createdLines,
    };
  });
}

export async function updateGoodsReceiptNote(
  _token: string | null,
  _orgId: string,
  grnId: string,
  body: GrnUpdateBody
): Promise<GoodsReceiptNoteResponse> {
  return await withTransaction(async (db) => {
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE goods_receipt_notes SET supplier_id = ?, received_at = ? WHERE id = ?`,
      [body.supplierId, body.receivedAt, grnId]
    );

    // If lines provided, adjust inventory differences
    if (body.lines && body.lines.length > 0) {
      // Revert previous lines from stock
      const oldLines = await db.getAllAsync<{ item_id: string; quantity: number }>(
        `SELECT item_id, quantity FROM grn_lines WHERE grn_id = ?`,
        [grnId]
      );
      for (const oldLine of oldLines) {
        await db.runAsync(
          `UPDATE items SET current_stock = current_stock - ?, updated_at = ? WHERE id = ?`,
          [oldLine.quantity, now, oldLine.item_id]
        );
      }
      await db.runAsync(`DELETE FROM grn_lines WHERE grn_id = ?`, [grnId]);

      // Insert new lines and add to stock
      for (const line of body.lines) {
        const lineId = "grnl-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
        const unitCost = line.receivedUnitCost ?? 0;
        await db.runAsync(
          `INSERT INTO grn_lines (id, grn_id, item_id, quantity, unit_cost, total_cost)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [lineId, grnId, line.itemId, line.qty, unitCost, line.qty * unitCost]
        );
        await db.runAsync(
          `UPDATE items SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?`,
          [line.qty, now, line.itemId]
        );
      }
    }

    const grn = await db.getFirstAsync<any>(
      `SELECT g.*, s.name as supplier_name 
       FROM goods_receipt_notes g 
       LEFT JOIN suppliers s ON g.supplier_id = s.id 
       WHERE g.id = ?`,
      [grnId]
    );

    const lines = await db.getAllAsync<any>(
      `SELECT gl.*, i.name as item_name, i.barcode 
       FROM grn_lines gl 
       JOIN items i ON gl.item_id = i.id 
       WHERE gl.grn_id = ?`,
      [grnId]
    );

    return {
      id: grnId,
      orgId: "offline-org",
      branchId: "offline-branch",
      supplierId: grn.supplier_id,
      supplierName: grn.supplier_name ?? "Supplier",
      purchaseOrderId: null,
      receivedByStaffUserId: "offline-user",
      receivedAt: grn.received_at,
      createdAt: grn.created_at,
      active: grn.status === "COMPLETED",
      lines: lines.map((l) => ({
        id: l.id,
        grnId,
        itemId: l.item_id,
        itemName: l.item_name,
        barcode: l.barcode,
        qty: l.quantity,
        uomId: null,
        receivedUnitCost: l.unit_cost,
        createdAt: grn.created_at,
      })),
    };
  });
}

export async function deleteGoodsReceiptNotePermanently(
  _token: string | null,
  _orgId: string,
  grnId: string
): Promise<void> {
  await withTransaction(async (db) => {
    const now = new Date().toISOString();
    const lines = await db.getAllAsync<{ item_id: string; quantity: number }>(
      `SELECT item_id, quantity FROM grn_lines WHERE grn_id = ?`,
      [grnId]
    );
    for (const line of lines) {
      await db.runAsync(
        `UPDATE items SET current_stock = current_stock - ?, updated_at = ? WHERE id = ?`,
        [line.quantity, now, line.item_id]
      );
    }
    await db.runAsync(`DELETE FROM goods_receipt_notes WHERE id = ?`, [grnId]);
  });
}
