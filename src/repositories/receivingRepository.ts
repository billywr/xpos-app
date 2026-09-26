import { getDatabase, withTransaction } from "@/db/sqlite";
import { generateUuid } from "@/utils/uuid";
import { outboxEngine } from "@/services/outboxEngine";
import { roundHalfUp, SCALE, MONEY_SCALE } from "@/services/mathEngine";
import type { GoodsReceiptNoteResponse, GrnLineResponse } from "@/api/goodsReceiptNotes";

export class ReceivingRepository {
  /**
   * Retrieves all goods receipt notes and lines from local SQLite (<5ms).
   */
  public async getReceiptNotes(
    orgId: string,
    branchId: string
  ): Promise<GoodsReceiptNoteResponse[]> {
    const db = await getDatabase();

    const grnRows = await db.getAllAsync<any>(
      `SELECT g.*, s.name as supplierName 
       FROM goods_receipt_notes g
       LEFT JOIN suppliers s ON s.id = g.supplier_id
       WHERE g.org_id = ? AND g.branch_id = ?
       ORDER BY g.received_at DESC`,
      [orgId, branchId]
    );

    const result: GoodsReceiptNoteResponse[] = [];

    for (const g of grnRows) {
      const lineRows = await db.getAllAsync<any>(
        `SELECT l.*, i.name as itemName, i.sku as itemSku
         FROM grn_lines l
         JOIN items i ON i.id = l.item_id
         WHERE l.grn_id = ?`,
        [g.id]
      );

      const lines: GrnLineResponse[] = lineRows.map((l) => ({
        id: l.id,
        grnId: g.id,
        itemId: l.item_id,
        itemName: l.itemName,
        barcode: null,
        qty: Number(l.quantity) || 0,
        uomId: null,
        receivedUnitCost: Number(l.unit_cost) || 0,
        createdAt: g.created_at,
      }));

      result.push({
        id: g.id,
        orgId: g.org_id,
        branchId: g.branch_id,
        supplierId: g.supplier_id || "",
        supplierName: g.supplierName || "Direct / Internal",
        purchaseOrderId: null,
        receivedByStaffUserId: "",
        receivedAt: g.received_at,
        createdAt: g.created_at,
        active: true,
        lines,
      });
    }

    return result;
  }

  /**
   * Saves GRN locally and queues outbox event for sync.
   */
  public async createReceiptNote(
    orgId: string,
    branchId: string,
    params: {
      supplierId?: string | null;
      itemId: string;
      quantity: number;
      unitCost: number;
      notes?: string | null;
    }
  ): Promise<GoodsReceiptNoteResponse> {
    const grnId = generateUuid();
    const lineId = generateUuid();
    const grnNumber = `GRN-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();
    const qty = roundHalfUp(params.quantity, SCALE);
    const unitCost = roundHalfUp(params.unitCost, MONEY_SCALE);
    const totalCost = roundHalfUp(qty * unitCost, MONEY_SCALE);

    await withTransaction(async (db) => {
      // 1. Insert header
      await db.runAsync(
        `INSERT INTO goods_receipt_notes (
           id, org_id, branch_id, grn_number, supplier_id, status, notes, received_at, created_at, sync_status
         ) VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, 'PENDING')`,
        [grnId, orgId, branchId, grnNumber, params.supplierId || null, params.notes || null, now, now]
      );

      // 2. Insert line
      await db.runAsync(
        `INSERT INTO grn_lines (id, grn_id, item_id, quantity, unit_cost, total_cost)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [lineId, grnId, params.itemId, qty, unitCost, totalCost]
      );

      // 3. Update item current stock immediately
      await db.runAsync(
        `UPDATE items SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?`,
        [qty, now, params.itemId]
      );

      // 4. Update today's stock count sheet if open
      const todayDateStr = now.slice(0, 10);
      await db.runAsync(
        `UPDATE stock_count_lines 
         SET added_today_stock = added_today_stock + ?
         WHERE branch_id = ? AND business_date = ? AND item_id = ?`,
        [qty, branchId, todayDateStr, params.itemId]
      );

      // 5. Enqueue outbox mutation
      await outboxEngine.enqueue(
        {
          orgId,
          branchId,
          entityType: "GRN_CREATE",
          entityId: grnId,
          action: "CREATE",
          endpoint: `/api/v1/operator/orgs/${orgId}/branches/${branchId}/goods-receipt-notes`,
          httpMethod: "POST",
          payloadJson: JSON.stringify({
            supplierId: params.supplierId || null,
            receivedAt: now,
            notes: params.notes || null,
            lines: [
              {
                itemId: params.itemId,
                qty,
                receivedUnitCost: unitCost,
              },
            ],
          }),
        },
        db
      );
    });

    return {
      id: grnId,
      orgId,
      branchId,
      supplierId: params.supplierId || "",
      supplierName: "",
      purchaseOrderId: null,
      receivedByStaffUserId: "",
      receivedAt: now,
      createdAt: now,
      active: true,
      lines: [
        {
          id: lineId,
          grnId,
          itemId: params.itemId,
          itemName: "",
          barcode: null,
          qty,
          uomId: null,
          receivedUnitCost: unitCost,
          createdAt: now,
        },
      ],
    };
  }

  /**
   * Hydrates remote GRNs into local SQLite.
   */
  public async hydrateFromRemote(
    orgId: string,
    branchId: string,
    remoteNotes: GoodsReceiptNoteResponse[]
  ): Promise<void> {
    if (!remoteNotes || remoteNotes.length === 0) return;

    await withTransaction(async (db) => {
      for (const grn of remoteNotes) {
        const existing = await db.getFirstAsync<{ id: string }>(
          `SELECT id FROM goods_receipt_notes WHERE id = ?`,
          [grn.id]
        );

        if (!existing) {
          const now = new Date().toISOString();
          await db.runAsync(
            `INSERT INTO goods_receipt_notes (
               id, org_id, branch_id, grn_number, supplier_id, status, notes, received_at, created_at, sync_status
             ) VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, 'COMMITTED')`,
            [
              grn.id,
              orgId,
              branchId,
              grn.id,
              grn.supplierId,
              null,
              grn.receivedAt,
              grn.createdAt || now,
            ]
          );

          if (grn.lines) {
            for (const line of grn.lines) {
              await db.runAsync(
                `INSERT INTO grn_lines (id, grn_id, item_id, quantity, unit_cost, total_cost)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  line.id,
                  grn.id,
                  line.itemId,
                  line.qty,
                  line.receivedUnitCost || 0,
                  roundHalfUp((line.qty || 0) * (line.receivedUnitCost || 0), MONEY_SCALE),
                ]
              );
            }
          }
        }
      }
    });
  }
}

export const receivingRepository = new ReceivingRepository();
