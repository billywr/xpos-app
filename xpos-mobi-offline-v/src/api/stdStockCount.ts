import { getDatabase, withTransaction } from "@/db/database";
import type {
  StdStockCountSheetResponse,
  StdStockCountSaveRequest,
  StdStockCountSalesPreviewResponse,
  StdStockCountReconcilePreviewResponse,
  StdStockCountRowResponse,
  StdStockCountSalesLineResponse,
  StdStockCountReconcileLineResponse,
} from "@/types";

export async function fetchStdStockCountSheet(
  _token: string | null,
  _orgId: string,
  _branchId: string,
  date: string
): Promise<StdStockCountSheetResponse> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  // Ensure sheet entry exists
  await db.runAsync(
    `INSERT OR IGNORE INTO stock_count_sheets (id, date, status, notes) VALUES (?, ?, 'DRAFT', '')`,
    ["sheet-" + date, date]
  );

  // Fetch all active items
  const items = await db.getAllAsync<any>(
    `SELECT id, name, sku, selling_price, cost_price, current_stock 
     FROM items 
     WHERE active = 1 
     ORDER BY name ASC`
  );

  // Calculate prior date string for carry-forward opening stock
  const currentDateObj = new Date(date + "T00:00:00Z");
  currentDateObj.setUTCDate(currentDateObj.getUTCDate() - 1);
  const priorDateStr = currentDateObj.toISOString().slice(0, 10);

  const rows: StdStockCountRowResponse[] = [];

  for (const item of items) {
    // Sum today's GRN receipts for this item
    const grnSum = await db.getFirstAsync<{ total: number | null }>(
      `SELECT SUM(gl.quantity) as total 
       FROM grn_lines gl 
       JOIN goods_receipt_notes g ON gl.grn_id = g.id 
       WHERE gl.item_id = ? AND date(g.received_at) = ?`,
      [item.id, date]
    );
    const addedTodayStock = Number(grnSum?.total ?? 0);

    // Check if line already exists for today's sheet
    let line = await db.getFirstAsync<any>(
      `SELECT * FROM stock_count_lines WHERE sheet_date = ? AND item_id = ?`,
      [date, item.id]
    );

    if (!line) {
      // Find prior day closing count
      const priorLine = await db.getFirstAsync<any>(
        `SELECT closing_count FROM stock_count_lines WHERE sheet_date = ? AND item_id = ?`,
        [priorDateStr, item.id]
      );

      let openingStock = 0;
      if (priorLine && priorLine.closing_count != null) {
        openingStock = Number(priorLine.closing_count);
      } else {
        // Fallback: current on-hand stock minus today's added stock
        openingStock = Math.max(0, Number(item.current_stock) - addedTodayStock);
      }

      const lineId = "scl-" + date + "-" + item.id;
      await db.runAsync(
        `INSERT INTO stock_count_lines 
          (id, sheet_date, item_id, opening_stock, received_stock, closing_count, units_sold, revenue, variance, recorded_units_sold)
         VALUES (?, ?, ?, ?, ?, NULL, 0, 0, 0, 0)`,
        [lineId, date, item.id, openingStock, addedTodayStock]
      );

      line = {
        opening_stock: openingStock,
        received_stock: addedTodayStock,
        closing_count: null,
        last_saved_at: null,
      };
    } else {
      // Keep received_stock up to date if new GRNs came in
      if (Number(line.received_stock) !== addedTodayStock) {
        await db.runAsync(
          `UPDATE stock_count_lines SET received_stock = ? WHERE sheet_date = ? AND item_id = ?`,
          [addedTodayStock, date, item.id]
        );
      }
    }

    rows.push({
      itemId: item.id,
      sku: item.sku ?? "",
      name: item.name,
      openingStock: Number(line.opening_stock ?? 0),
      addedStock: addedTodayStock,
      addedTodayStock: addedTodayStock,
      sellingPrice: Number(item.selling_price ?? 0),
      closingStock: line.closing_count != null ? Number(line.closing_count) : null,
      lastSavedAt: line.last_saved_at ?? null,
      firstStockAddedAt: null,
      comments: null,
    });
  }

  return {
    date,
    outletId: "offline-branch",
    rows,
  };
}

export async function saveStdStockCount(
  _token: string | null,
  _orgId: string,
  _branchId: string,
  body: StdStockCountSaveRequest
): Promise<StdStockCountSheetResponse> {
  const now = new Date().toISOString();

  await withTransaction(async (db) => {
    await db.runAsync(
      `INSERT OR IGNORE INTO stock_count_sheets (id, date, status) VALUES (?, ?, 'DRAFT')`,
      ["sheet-" + body.date, body.date]
    );

    for (const count of body.counts) {
      const closingVal = count.closingStock;

      const current = await db.getFirstAsync<any>(
        `SELECT scl.*, i.selling_price, i.current_stock
         FROM stock_count_lines scl
         JOIN items i ON scl.item_id = i.id
         WHERE scl.sheet_date = ? AND scl.item_id = ?`,
        [body.date, count.itemId]
      );

      if (current) {
        const opening = Number(current.opening_stock ?? 0);
        const received = Number(current.received_stock ?? 0);
        const sellingPrice = Number(current.selling_price ?? 0);
        const unitsSold = Math.max(0, opening + received - closingVal);
        const revenue = unitsSold * sellingPrice;
        const variance = closingVal - Number(current.current_stock ?? 0);

        await db.runAsync(
          `UPDATE stock_count_lines SET
            closing_count = ?,
            units_sold = ?,
            revenue = ?,
            variance = ?,
            last_saved_at = ?
           WHERE sheet_date = ? AND item_id = ?`,
          [closingVal, unitsSold, revenue, variance, now, body.date, count.itemId]
        );
      }
    }

    await db.runAsync(
      `UPDATE stock_count_sheets SET last_saved_at = ? WHERE date = ?`,
      [now, body.date]
    );
  });

  return await fetchStdStockCountSheet(null, _orgId, _branchId, body.date);
}

export async function fetchStdStockCountSalesPreview(
  _token: string | null,
  _orgId: string,
  _branchId: string,
  date: string
): Promise<StdStockCountSalesPreviewResponse> {
  const db = await getDatabase();

  const lines = await db.getAllAsync<any>(
    `SELECT 
      scl.item_id as itemId,
      i.name,
      scl.opening_stock as openingStock,
      scl.received_stock as receivedStock,
      scl.closing_count as closingStock,
      scl.recorded_units_sold as alreadyRecorded,
      i.selling_price as unitPrice
    FROM stock_count_lines scl
    JOIN items i ON scl.item_id = i.id
    WHERE scl.sheet_date = ?`,
    [date]
  );

  const previewLines: StdStockCountSalesLineResponse[] = [];
  let totalQtyToRecord = 0;
  let totalValueToRecord = 0;

  for (const l of lines) {
    const opening = Number(l.openingStock ?? 0);
    const received = Number(l.receivedStock ?? 0);
    const closing = l.closingStock != null ? Number(l.closingStock) : (opening + received);
    const impliedSold = Math.max(0, opening + received - closing);
    const alreadyRecorded = Number(l.alreadyRecorded ?? 0);
    const qtyToRecord = Math.max(0, impliedSold - alreadyRecorded);
    const unitPrice = Number(l.unitPrice ?? 0);
    const lineValue = qtyToRecord * unitPrice;

    totalQtyToRecord += qtyToRecord;
    totalValueToRecord += lineValue;

    previewLines.push({
      itemId: l.itemId,
      name: l.name,
      impliedSold,
      alreadyRecorded,
      qtyToRecord,
      qtyRecorded: alreadyRecorded > 0 ? alreadyRecorded : null,
      unitPrice,
      lineValue,
      status: qtyToRecord > 0 ? "READY" : "RECORDED",
    });
  }

  return {
    date,
    branchId: "offline-branch",
    lines: previewLines,
    totalQtyToRecord,
    totalValueToRecord,
  };
}

export async function recordStdStockCountSales(
  _token: string | null,
  _orgId: string,
  _branchId: string,
  body: { date: string; terminalId: string }
): Promise<any> {
  const preview = await fetchStdStockCountSalesPreview(null, _orgId, _branchId, body.date);
  const itemsToRecord = preview.lines.filter((l) => l.qtyToRecord > 0);

  if (itemsToRecord.length === 0) {
    return { success: true, message: "No new sales to record." };
  }

  return await withTransaction(async (db) => {
    const now = new Date().toISOString();
    const saleId = "sale-" + Date.now();
    const receiptNumber = "REC-" + Date.now().toString().slice(-6);

    let totalRevenue = 0;
    let totalCogs = 0;

    for (const item of itemsToRecord) {
      const itemRow = await db.getFirstAsync<{ cost_price: number }>(
        `SELECT cost_price FROM items WHERE id = ?`,
        [item.itemId]
      );
      const unitCost = Number(itemRow?.cost_price ?? 0);
      const lineCost = item.qtyToRecord * unitCost;
      const lineRevenue = item.lineValue;

      totalRevenue += lineRevenue;
      totalCogs += lineCost;

      const saleLineId = "sline-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
      await db.runAsync(
        `INSERT INTO sale_lines (id, sale_id, item_id, quantity, unit_price, unit_cost, total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [saleLineId, saleId, item.itemId, item.qtyToRecord, item.unitPrice, unitCost, lineRevenue]
      );

      // Increment recorded units sold on sheet line
      await db.runAsync(
        `UPDATE stock_count_lines 
         SET recorded_units_sold = recorded_units_sold + ?
         WHERE sheet_date = ? AND item_id = ?`,
        [item.qtyToRecord, body.date, item.itemId]
      );
    }

    // Insert completed sale
    await db.runAsync(
      `INSERT INTO sales (id, receipt_number, sale_date, completed_at, total, tax_total, cogs_total, status, source)
       VALUES (?, ?, ?, ?, ?, 0.0, ?, 'COMPLETED', 'STOCK_COUNT')`,
      [saleId, receiptNumber, body.date, now, totalRevenue, totalCogs]
    );

    return {
      success: true,
      saleId,
      receiptNumber,
      totalRecorded: totalRevenue,
      linesCount: itemsToRecord.length,
    };
  });
}

export async function fetchStdStockCountReconcilePreview(
  _token: string | null,
  _orgId: string,
  _branchId: string,
  date: string
): Promise<StdStockCountReconcilePreviewResponse> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<any>(
    `SELECT 
      scl.item_id as itemId,
      i.name,
      scl.closing_count as closingStock,
      i.current_stock as onHandQty
    FROM stock_count_lines scl
    JOIN items i ON scl.item_id = i.id
    WHERE scl.sheet_date = ? AND scl.closing_count IS NOT NULL`,
    [date]
  );

  const lines: StdStockCountReconcileLineResponse[] = rows.map((r) => {
    const closing = Number(r.closingStock);
    const onHand = Number(r.onHandQty);
    return {
      itemId: r.itemId,
      name: r.name,
      closingStock: closing,
      onHandQty: onHand,
      variance: closing - onHand,
    };
  });

  const itemsAdjusted = lines.filter((l) => l.variance !== 0).length;
  const itemsAlreadyMatched = lines.filter((l) => l.variance === 0).length;

  return {
    date,
    branchId: "offline-branch",
    lines,
    itemsAdjusted,
    itemsAlreadyMatched,
  };
}

export async function reconcileStdStockCountInventory(
  _token: string | null,
  _orgId: string,
  _branchId: string,
  body: { date: string; outletId: string }
): Promise<any> {
  return await withTransaction(async (db) => {
    const now = new Date().toISOString();

    const lines = await db.getAllAsync<any>(
      `SELECT item_id, closing_count 
       FROM stock_count_lines 
       WHERE sheet_date = ? AND closing_count IS NOT NULL`,
      [body.date]
    );

    for (const line of lines) {
      await db.runAsync(
        `UPDATE items SET current_stock = ?, updated_at = ? WHERE id = ?`,
        [Number(line.closing_count), now, line.item_id]
      );
    }

    await db.runAsync(
      `UPDATE stock_count_sheets SET status = 'RECONCILED', reconciled_at = ? WHERE date = ?`,
      [now, body.date]
    );

    return {
      success: true,
      reconciledCount: lines.length,
      date: body.date,
    };
  });
}
