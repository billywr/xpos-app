import { getDatabase, withTransaction } from "@/db/sqlite";
import { generateUuid } from "@/utils/uuid";
import { outboxEngine } from "@/services/outboxEngine";
import { roundHalfUp, SCALE, MONEY_SCALE } from "@/services/mathEngine";
import type { GoodsReceiptNoteResponse, GrnLineResponse, GrnUpdateBody } from "@/api/goodsReceiptNotes";

export class ReceivingRepository {
  /**
   * Retrieves suppliers from local SQLite (<2ms).
   */
  public async getSuppliers(
    orgId: string
  ): Promise<{ id: string; name: string; phone: string | null; email: string | null }[]> {
    const db = await getDatabase();
    return await db.getAllAsync<any>(
      `SELECT id, name, phone, email FROM suppliers WHERE org_id = ? ORDER BY name ASC`,
      [orgId]
    );
  }

  /**
   * Hydrates remote suppliers into local SQLite.
   */
  public async hydrateSuppliersFromRemote(
    orgId: string,
    remoteSuppliers: { id: string; name: string; phone?: string | null; email?: string | null; createdAt?: string; updatedAt?: string }[]
  ): Promise<void> {
    if (!remoteSuppliers || remoteSuppliers.length === 0) return;
    await withTransaction(async (db) => {
      for (const s of remoteSuppliers) {
        const dt = new Date().toISOString();
        await db.runAsync(
          `INSERT INTO suppliers (id, org_id, name, phone, email, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             phone = excluded.phone,
             email = excluded.email,
             updated_at = excluded.updated_at`,
          [s.id, orgId, s.name, s.phone || null, s.email || null, s.createdAt || dt, s.updatedAt || dt]
        );
      }
    });
  }

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

    if (grnRows.length === 0) return [];

    const grnIds = grnRows.map((g) => g.id);
    const placeholders = grnIds.map(() => "?").join(",");
    const allLines = await db.getAllAsync<any>(
      `SELECT l.*, COALESCE(i.name, 'Item ' || SUBSTR(l.item_id, 1, 8)) as itemName, i.sku as itemSku
       FROM grn_lines l
       LEFT JOIN items i ON i.id = l.item_id
       WHERE l.grn_id IN (${placeholders})`,
      grnIds
    );

    const linesByGrnId = new Map<string, GrnLineResponse[]>();
    for (const l of allLines) {
      const arr = linesByGrnId.get(l.grn_id) || [];
      arr.push({
        id: l.id,
        grnId: l.grn_id,
        itemId: l.item_id,
        itemName: l.itemName || "Item",
        barcode: null,
        qty: Number(l.quantity) || 0,
        uomId: null,
        receivedUnitCost: Number(l.unit_cost) || 0,
        createdAt: l.created_at || "",
      });
      linesByGrnId.set(l.grn_id, arr);
    }

    return grnRows.map((g) => ({
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
      lines: linesByGrnId.get(g.id) || [],
    }));
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
   * Hydrates remote GRNs into local SQLite (<10ms bulk upsert).
   */
  public async hydrateFromRemote(
    orgId: string,
    branchId: string,
    remoteNotes: GoodsReceiptNoteResponse[]
  ): Promise<void> {
    if (!remoteNotes || remoteNotes.length === 0) return;

    await withTransaction(async (db) => {
      const now = new Date().toISOString();
      for (const grn of remoteNotes) {
        const supplierId = grn.supplierId?.trim() ? grn.supplierId.trim() : null;
        const grnNumber = (grn as any).grnNumber || grn.id;

        await db.runAsync(
          `INSERT INTO goods_receipt_notes (
             id, org_id, branch_id, grn_number, supplier_id, status, notes, received_at, created_at, sync_status
           ) VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, 'COMMITTED')
           ON CONFLICT(id) DO UPDATE SET
             supplier_id = excluded.supplier_id,
             received_at = excluded.received_at,
             created_at = excluded.created_at`,
          [
            grn.id,
            orgId,
            branchId,
            grnNumber,
            supplierId,
            null,
            grn.receivedAt,
            grn.createdAt || now,
          ]
        );

        if (grn.lines && grn.lines.length > 0) {
          for (const line of grn.lines) {
            await db.runAsync(
              `INSERT INTO grn_lines (id, grn_id, item_id, quantity, unit_cost, total_cost)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 quantity = excluded.quantity,
                 unit_cost = excluded.unit_cost,
                 total_cost = excluded.total_cost`,
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
    });
  }

  /**
   * Updates an existing GRN locally and enqueues an outbox mutation for background sync.
   */
  public async updateReceiptNote(
    orgId: string,
    branchId: string,
    grnId: string,
    body: GrnUpdateBody
  ): Promise<void> {
    await withTransaction(async (db) => {
      await db.runAsync(
        `UPDATE goods_receipt_notes SET supplier_id = COALESCE(?, supplier_id), sync_status = 'PENDING' WHERE id = ?`,
        [body.supplierId || null, grnId]
      );
      if (body.lines && body.lines.length > 0) {
        for (const line of body.lines) {
          await db.runAsync(
            `UPDATE grn_lines SET quantity = ?, unit_cost = ?, total_cost = ? WHERE grn_id = ? AND item_id = ?`,
            [
              line.qty,
              line.receivedUnitCost || 0,
              roundHalfUp((line.qty || 0) * (line.receivedUnitCost || 0), MONEY_SCALE),
              grnId,
              line.itemId,
            ]
          );
        }
      }

      await outboxEngine.enqueue(
        {
          orgId,
          branchId,
          entityType: "GRN_UPDATE",
          entityId: grnId,
          action: "UPDATE",
          endpoint: `/api/v1/admin/orgs/${orgId}/goods-receipt-notes/${grnId}`,
          httpMethod: "PATCH",
          payloadJson: JSON.stringify(body),
        },
        db
      );
    });
  }

  /**
   * Deletes a GRN locally and enqueues an outbox mutation for background sync.
   */
  public async deleteReceiptNote(
    orgId: string,
    branchId: string,
    grnId: string
  ): Promise<void> {
    await withTransaction(async (db) => {
      await db.runAsync(`DELETE FROM grn_lines WHERE grn_id = ?`, [grnId]);
      await db.runAsync(`DELETE FROM goods_receipt_notes WHERE id = ?`, [grnId]);

      await outboxEngine.enqueue(
        {
          orgId,
          branchId,
          entityType: "GRN_DELETE",
          entityId: grnId,
          action: "DELETE",
          endpoint: `/api/v1/admin/orgs/${orgId}/goods-receipt-notes/${grnId}`,
          httpMethod: "DELETE",
          payloadJson: "{}",
        },
        db
      );
    });
  }
}

export const receivingRepository = new ReceivingRepository();
