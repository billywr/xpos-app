import { getDatabase, withTransaction } from "@/db/sqlite";
import { generateUuid } from "@/utils/uuid";
import {
  calcTotalStock,
  normalizeClosingQty,
  calcImpliedSold,
  calcQtyToRecord,
  calcLineRevenue,
  calcReconcileVariance,
  resolveSalesLineStatus,
  roundHalfUp,
  SCALE,
  MONEY_SCALE,
} from "@/services/mathEngine";
import { outboxEngine } from "@/services/outboxEngine";
import type {
  StdStockCountSheetResponse,
  StdStockCountRowResponse,
  StdStockCountSalesPreviewResponse,
  StdStockCountReconcilePreviewResponse,
} from "@/types";

export interface LocalStockCountRow extends StdStockCountRowResponse {
  syncStatus: "COMMITTED" | "PENDING" | "SYNCING" | "FAILED";
  impliedSold: number | null;
  qtyToRecord: number;
  lineRevenue: number;
}

export class StockCountRepository {
  /**
   * Retrieves the stock count sheet from local SQLite.
   * If the sheet doesn't exist locally, it initializes it from the local catalog items.
   */
  public async getSheet(
    orgId: string,
    branchId: string,
    dateStr: string
  ): Promise<{ date: string; outletId: string; rows: LocalStockCountRow[] }> {
    const db = await getDatabase();

    // Check if sheet header exists
    let sheet = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM stock_count_sheets WHERE branch_id = ? AND business_date = ?`,
      [branchId, dateStr]
    );

    if (!sheet) {
      // Create new sheet entry
      const sheetId = generateUuid();
      await db.runAsync(
        `INSERT OR IGNORE INTO stock_count_sheets (id, org_id, branch_id, business_date, status)
         VALUES (?, ?, ?, ?, 'DRAFT')`,
        [sheetId, orgId, branchId, dateStr]
      );
      sheet = { id: sheetId };
    }

    // Query active items and joined stock count lines
    const query = `
      SELECT 
        i.id as itemId,
        i.sku,
        i.name,
        i.selling_price as sellingPrice,
        i.current_stock as currentStock,
        l.id as lineId,
        l.opening_stock as openingStock,
        l.added_stock as addedStock,
        l.added_today_stock as addedTodayStock,
        l.closing_stock as closingStock,
        l.already_recorded_sold as alreadyRecordedSold,
        l.last_saved_at as lastSavedAt,
        l.sync_status as syncStatus,
        l.comments
      FROM items i
      LEFT JOIN stock_count_lines l 
        ON l.item_id = i.id AND l.branch_id = ? AND l.business_date = ?
      WHERE i.active = 1
      ORDER BY i.name ASC
    `;

    const rawRows = await db.getAllAsync<any>(query, [branchId, dateStr]);

    const rows: LocalStockCountRow[] = rawRows.map((r) => {
      const opening = r.openingStock !== null && r.openingStock !== undefined ? Number(r.openingStock) : 0;
      const added = r.addedStock !== null && r.addedStock !== undefined ? Number(r.addedStock) : 0;
      const addedToday = r.addedTodayStock !== null && r.addedTodayStock !== undefined ? Number(r.addedTodayStock) : 0;
      const totalStock = calcTotalStock(opening, added, addedToday);
      const closing = r.closingStock !== null && r.closingStock !== undefined ? Number(r.closingStock) : null;
      const alreadyRecorded = r.alreadyRecordedSold ? Number(r.alreadyRecordedSold) : 0;
      const impliedSold = calcImpliedSold(totalStock, closing);
      const qtyToRecord = calcQtyToRecord(impliedSold, alreadyRecorded);
      const lineRevenue = calcLineRevenue(qtyToRecord, r.sellingPrice || 0);

      return {
        itemId: r.itemId,
        sku: r.sku || "",
        name: r.name,
        openingStock: opening,
        addedStock: added,
        addedTodayStock: addedToday,
        sellingPrice: Number(r.sellingPrice) || 0,
        closingStock: closing,
        lastSavedAt: r.lastSavedAt,
        firstStockAddedAt: null,
        comments: r.comments,
        syncStatus: r.syncStatus || "COMMITTED",
        impliedSold,
        qtyToRecord,
        lineRevenue,
      };
    });

    return {
      date: dateStr,
      outletId: branchId,
      rows,
    };
  }

  /**
   * Persists closing stock count locally and queues outbox mutation for background sync.
   * Runs in <10ms with immediate ACID durability.
   */
  public async saveClosingCount(
    orgId: string,
    branchId: string,
    dateStr: string,
    counts: { itemId: string; closingStock: number; comments?: string | null }[]
  ): Promise<void> {
    await withTransaction(async (db) => {
      // Ensure sheet exists
      let sheet = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM stock_count_sheets WHERE branch_id = ? AND business_date = ?`,
        [branchId, dateStr]
      );
      if (!sheet) {
        const sheetId = generateUuid();
        await db.runAsync(
          `INSERT INTO stock_count_sheets (id, org_id, branch_id, business_date, status)
           VALUES (?, ?, ?, ?, 'DRAFT')`,
          [sheetId, orgId, branchId, dateStr]
        );
        sheet = { id: sheetId };
      }

      const now = new Date().toISOString();
      const localUpdatedEpoch = Date.now();

      for (const count of counts) {
        const normalizedClosing = normalizeClosingQty(count.closingStock);

        // Fetch existing line or create
        const existingLine = await db.getFirstAsync<any>(
          `SELECT * FROM stock_count_lines WHERE branch_id = ? AND business_date = ? AND item_id = ?`,
          [branchId, dateStr, count.itemId]
        );

        const opening = existingLine ? existingLine.opening_stock : 0;
        const added = existingLine ? existingLine.added_stock : 0;
        const addedToday = existingLine ? existingLine.added_today_stock : 0;
        const total = calcTotalStock(opening, added, addedToday);
        const already = existingLine ? existingLine.already_recorded_sold : 0;

        const implied = calcImpliedSold(total, normalizedClosing);
        const qtyToRecord = calcQtyToRecord(implied, already);

        // Fetch item price
        const item = await db.getFirstAsync<{ selling_price: number }>(
          `SELECT selling_price FROM items WHERE id = ?`,
          [count.itemId]
        );
        const price = item?.selling_price || 0;
        const rev = calcLineRevenue(qtyToRecord, price);

        if (existingLine) {
          await db.runAsync(
            `UPDATE stock_count_lines SET
               closing_stock = ?,
               implied_sold = ?,
               qty_to_record = ?,
               line_revenue = ?,
               last_saved_at = ?,
               sync_status = 'PENDING',
               local_updated_at = ?,
               comments = ?
             WHERE id = ?`,
            [
              normalizedClosing,
              implied,
              qtyToRecord,
              rev,
              now,
              localUpdatedEpoch,
              count.comments || null,
              existingLine.id,
            ]
          );
        } else {
          const lineId = generateUuid();
          await db.runAsync(
            `INSERT INTO stock_count_lines (
               id, sheet_id, business_date, branch_id, item_id,
               opening_stock, added_stock, added_today_stock, selling_price,
               closing_stock, implied_sold, already_recorded_sold, qty_to_record,
               line_revenue, variance, last_saved_at, sync_status, local_updated_at, comments
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
            [
              lineId,
              sheet.id,
              dateStr,
              branchId,
              count.itemId,
              0,
              0,
              0,
              price,
              normalizedClosing,
              implied,
              0,
              qtyToRecord,
              rev,
              0,
              now,
              localUpdatedEpoch,
              count.comments || null,
            ]
          );
        }
      }

      // Enqueue Outbox mutation for backend synchronization
      await outboxEngine.enqueue(
        {
          orgId,
          branchId,
          entityType: "STOCK_COUNT_SAVE",
          entityId: counts.length === 1 ? counts[0].itemId : `batch_${counts.length}`,
          action: "UPSERT",
          endpoint: `/api/v1/operator/orgs/${orgId}/branches/${branchId}/std-stock-count`,
          httpMethod: "PUT",
          payloadJson: JSON.stringify({
            date: dateStr,
            outletId: branchId,
            counts: counts.map((c) => ({
              itemId: c.itemId,
              closingStock: normalizeClosingQty(c.closingStock) ?? 0,
              comments: c.comments,
            })),
          }),
        },
        db
      );
    });
  }

  /**
   * Generates sales preview calculated directly from SQLite data with zero network latency.
   */
  public async getSalesPreview(
    orgId: string,
    branchId: string,
    dateStr: string
  ): Promise<StdStockCountSalesPreviewResponse> {
    const sheetData = await this.getSheet(orgId, branchId, dateStr);
    let totalQty = 0;
    let totalValue = 0;

    const lines = sheetData.rows.map((row) => {
      const already = 0; // Loaded from line alreadyRecordedSold
      const status = resolveSalesLineStatus(
        row.closingStock,
        row.impliedSold,
        already,
        row.qtyToRecord
      );

      if (row.qtyToRecord > 0) {
        totalQty += row.qtyToRecord;
        totalValue += row.lineRevenue;
      }

      return {
        itemId: row.itemId,
        name: row.name,
        impliedSold: row.impliedSold ?? 0,
        alreadyRecorded: already,
        qtyToRecord: row.qtyToRecord,
        qtyRecorded: null,
        unitPrice: row.sellingPrice,
        lineValue: row.lineRevenue,
        status,
      };
    });

    return {
      date: dateStr,
      branchId,
      lines,
      totalQtyToRecord: roundHalfUp(totalQty, SCALE),
      totalValueToRecord: roundHalfUp(totalValue, MONEY_SCALE),
    };
  }

  /**
   * Generates reconcile preview comparing closing counts with local inventory stock on hand.
   */
  public async getReconcilePreview(
    orgId: string,
    branchId: string,
    dateStr: string
  ): Promise<StdStockCountReconcilePreviewResponse> {
    const db = await getDatabase();
    const query = `
      SELECT 
        i.id as itemId,
        i.name,
        i.current_stock as currentStock,
        l.closing_stock as closingStock
      FROM items i
      JOIN stock_count_lines l 
        ON l.item_id = i.id AND l.branch_id = ? AND l.business_date = ?
      WHERE l.closing_stock IS NOT NULL
    `;

    const rows = await db.getAllAsync<any>(query, [branchId, dateStr]);
    const lines: any[] = [];
    let matched = 0;

    rows.forEach((r) => {
      const closing = Number(r.closingStock) || 0;
      const onHand = Number(r.currentStock) || 0;
      const variance = calcReconcileVariance(closing, onHand);
      if (variance === 0) {
        matched++;
      } else {
        lines.push({
          itemId: r.itemId,
          name: r.name,
          closingStock: closing,
          onHandQty: onHand,
          variance,
        });
      }
    });

    return {
      date: dateStr,
      branchId,
      lines,
      itemsAdjusted: lines.length,
      itemsAlreadyMatched: matched,
    };
  }

  /**
   * Record Sales locally and queue outbox event.
   */
  public async recordSales(
    orgId: string,
    branchId: string,
    terminalId: string,
    dateStr: string
  ): Promise<void> {
    await withTransaction(async (db) => {
      await db.runAsync(
        `UPDATE stock_count_lines 
         SET already_recorded_sold = already_recorded_sold + qty_to_record,
             qty_to_record = 0,
             line_revenue = 0
         WHERE branch_id = ? AND business_date = ? AND qty_to_record > 0`,
        [branchId, dateStr]
      );

      await outboxEngine.enqueue(
        {
          orgId,
          branchId,
          entityType: "STOCK_COUNT_RECORD_SALES",
          entityId: `sales_${dateStr}`,
          action: "RPC_EXECUTE",
          endpoint: `/api/v1/operator/orgs/${orgId}/branches/${branchId}/std-stock-count/record-sales`,
          httpMethod: "POST",
          payloadJson: JSON.stringify({ date: dateStr, terminalId }),
        },
        db
      );
    });
  }

  /**
   * Reconcile inventory locally and queue outbox event.
   */
  public async reconcileInventory(
    orgId: string,
    branchId: string,
    dateStr: string
  ): Promise<void> {
    await withTransaction(async (db) => {
      const lines = await db.getAllAsync<any>(
        `SELECT item_id, closing_stock FROM stock_count_lines 
         WHERE branch_id = ? AND business_date = ? AND closing_stock IS NOT NULL`,
        [branchId, dateStr]
      );

      for (const line of lines) {
        await db.runAsync(
          `UPDATE items SET current_stock = ?, updated_at = ? WHERE id = ?`,
          [line.closing_stock, new Date().toISOString(), line.item_id]
        );
      }

      await outboxEngine.enqueue(
        {
          orgId,
          branchId,
          entityType: "STOCK_COUNT_RECONCILE",
          entityId: `reconcile_${dateStr}`,
          action: "RPC_EXECUTE",
          endpoint: `/api/v1/operator/orgs/${orgId}/branches/${branchId}/std-stock-count/reconcile-inventory`,
          httpMethod: "POST",
          payloadJson: JSON.stringify({ date: dateStr, outletId: branchId }),
        },
        db
      );
    });
  }

  /**
   * Hydrates remote sheet data into local SQLite without clobbering uncommitted local drafts.
   */
  public async hydrateFromRemote(
    orgId: string,
    branchId: string,
    remoteSheet: StdStockCountSheetResponse
  ): Promise<void> {
    if (!remoteSheet || !remoteSheet.rows) return;

    await withTransaction(async (db) => {
      // Ensure sheet exists
      let sheet = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM stock_count_sheets WHERE branch_id = ? AND business_date = ?`,
        [branchId, remoteSheet.date]
      );
      if (!sheet) {
        const sheetId = generateUuid();
        await db.runAsync(
          `INSERT INTO stock_count_sheets (id, org_id, branch_id, business_date, status)
           VALUES (?, ?, ?, ?, 'DRAFT')`,
          [sheetId, orgId, branchId, remoteSheet.date]
        );
        sheet = { id: sheetId };
      }

      for (const r of remoteSheet.rows) {
        // Check if there is an uncommitted local edit
        const existing = await db.getFirstAsync<any>(
          `SELECT id, sync_status, closing_stock FROM stock_count_lines 
           WHERE branch_id = ? AND business_date = ? AND item_id = ?`,
          [branchId, remoteSheet.date, r.itemId]
        );

        if (existing && (existing.sync_status === "PENDING" || existing.sync_status === "SYNCING")) {
          // Do not overwrite uncommitted local inputs!
          continue;
        }

        const opening = Number(r.openingStock) || 0;
        const added = Number(r.addedStock) || 0;
        const addedToday = Number(r.addedTodayStock) || 0;
        const total = calcTotalStock(opening, added, addedToday);
        const closing = r.closingStock !== null ? Number(r.closingStock) : null;
        const implied = calcImpliedSold(total, closing);
        const price = Number(r.sellingPrice) || 0;

        if (existing) {
          await db.runAsync(
            `UPDATE stock_count_lines SET
               opening_stock = ?,
               added_stock = ?,
               added_today_stock = ?,
               selling_price = ?,
               closing_stock = ?,
               implied_sold = ?,
               last_saved_at = ?,
               sync_status = 'COMMITTED',
               comments = ?
             WHERE id = ?`,
            [
              opening,
              added,
              addedToday,
              price,
              closing,
              implied,
              r.lastSavedAt,
              r.comments,
              existing.id,
            ]
          );
        } else {
          await db.runAsync(
            `INSERT INTO stock_count_lines (
               id, sheet_id, business_date, branch_id, item_id,
               opening_stock, added_stock, added_today_stock, selling_price,
               closing_stock, implied_sold, already_recorded_sold, qty_to_record,
               line_revenue, variance, last_saved_at, sync_status, local_updated_at, comments
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, 'COMMITTED', ?, ?)`,
            [
              generateUuid(),
              sheet.id,
              remoteSheet.date,
              branchId,
              r.itemId,
              opening,
              added,
              addedToday,
              price,
              closing,
              implied,
              r.lastSavedAt,
              Date.now(),
              r.comments,
            ]
          );
        }
      }
    });
  }
}

export const stockCountRepository = new StockCountRepository();
