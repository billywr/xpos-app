/**
 * Authoritative Mathematical Calculation Engine for XPOS Mobile.
 *
 * Strictly replicates backend Java calculations from:
 * com.blinc.xpos.modules.inventory.service.impl.StdStockCountServiceImpl
 *
 * Rules:
 * - SCALE = 3 (quantities)
 * - MONEY_SCALE = 2 (financial amounts / currency)
 * - ROUNDING = RoundingMode.HALF_UP
 * - Zero synthetic formulas or client-side discrepancies.
 */

export const SCALE = 3;
export const MONEY_SCALE = 2;
export const BACKDATE_MAX_DAYS = 7;

/**
 * Standard commercial half-up rounding matching Java BigDecimal.setScale(scale, RoundingMode.HALF_UP)
 */
export function roundHalfUp(val: number, scale: number): number {
  if (val === null || val === undefined || Number.isNaN(val) || !Number.isFinite(val)) {
    return 0;
  }
  const factor = 10 ** scale;
  const shifted = Number(Math.round(Number(val + "e" + scale)) + "e-" + scale);
  return Number.isFinite(shifted) ? shifted : Math.round(val * factor) / factor;
}

/**
 * Compact numeric formatting: strips trailing zeros so 5.000 -> 5
 */
export function compact(val: number | null | undefined): number | null {
  if (val === null || val === undefined || Number.isNaN(val)) {
    return null;
  }
  return roundHalfUp(val, SCALE);
}

/**
 * Total stock available for standard stock count:
 * totalStock = openingStock + addedStock + addedTodayStock
 */
export function calcTotalStock(
  openingStock: number = 0,
  addedStock: number = 0,
  addedTodayStock: number = 0
): number {
  const sum = (Number(openingStock) || 0) + (Number(addedStock) || 0) + (Number(addedTodayStock) || 0);
  return roundHalfUp(Math.max(0, sum), SCALE);
}

/**
 * Normalizes closing stock count.
 * Negative counts are clamped to 0.000 as per backend `normalizeClosingQty`.
 */
export function normalizeClosingQty(closingStock: number | null | undefined): number | null {
  if (closingStock === null || closingStock === undefined || Number.isNaN(closingStock)) {
    return null;
  }
  const num = Math.max(0, Number(closingStock));
  return roundHalfUp(num, SCALE);
}

/**
 * Implied sold quantity:
 * If closingStock is null -> null (count not completed)
 * impliedSold = max(0, totalStock - closingStock)
 */
export function calcImpliedSold(
  totalStock: number,
  closingStock: number | null | undefined
): number | null {
  const normClosing = normalizeClosingQty(closingStock);
  if (normClosing === null) {
    return null;
  }
  const total = roundHalfUp(totalStock, SCALE);
  const implied = Math.max(0, total - normClosing);
  return roundHalfUp(implied, SCALE);
}

/**
 * Quantity to record for sales:
 * qtyToRecord = max(0, impliedSold - alreadyRecorded)
 */
export function calcQtyToRecord(
  impliedSold: number | null | undefined,
  alreadyRecorded: number = 0
): number {
  if (impliedSold === null || impliedSold === undefined || Number.isNaN(impliedSold)) {
    return 0;
  }
  const already = roundHalfUp(Math.max(0, Number(alreadyRecorded) || 0), SCALE);
  const qty = Math.max(0, roundHalfUp(impliedSold, SCALE) - already);
  return roundHalfUp(qty, SCALE);
}

/**
 * Financial line value:
 * lineValue = round(qtyToRecord * unitPrice, 2)
 */
export function calcLineRevenue(qtyToRecord: number, unitPrice: number): number {
  const qty = roundHalfUp(Math.max(0, Number(qtyToRecord) || 0), SCALE);
  const price = roundHalfUp(Math.max(0, Number(unitPrice) || 0), MONEY_SCALE);
  return roundHalfUp(qty * price, MONEY_SCALE);
}

/**
 * Inventory variance for stock count reconciliation:
 * variance = closingStock - onHandStock
 * Positive: surplus / found stock.
 * Negative: deficit / shrinkage.
 */
export function calcReconcileVariance(
  closingStock: number,
  onHandStock: number
): number {
  const closing = roundHalfUp(Number(closingStock) || 0, SCALE);
  const onHand = roundHalfUp(Number(onHandStock) || 0, SCALE);
  return roundHalfUp(closing - onHand, SCALE);
}

export type SalesLineStatus =
  | "SKIPPED_NO_CLOSING"
  | "SKIPPED_NO_IMPLIED_SALE"
  | "WARNING_OVER_RECORDED"
  | "SKIPPED_NO_QTY"
  | null;

/**
 * Resolves line status matching backend `buildSalesLineDto` in StdStockCountServiceImpl.
 */
export function resolveSalesLineStatus(
  closingStock: number | null | undefined,
  impliedSold: number | null | undefined,
  alreadyRecorded: number,
  qtyToRecord: number
): SalesLineStatus {
  if (closingStock === null || closingStock === undefined) {
    return "SKIPPED_NO_CLOSING";
  }
  if (impliedSold === null || impliedSold === undefined || impliedSold <= 0) {
    return "SKIPPED_NO_IMPLIED_SALE";
  }
  const already = roundHalfUp(alreadyRecorded, SCALE);
  const implied = roundHalfUp(impliedSold, SCALE);
  if (already > implied) {
    return "WARNING_OVER_RECORDED";
  }
  if (qtyToRecord <= 0) {
    return "SKIPPED_NO_QTY";
  }
  return null;
}

/**
 * Validates sale date against 7-day backdate constraint:
 * today - 7 days <= saleDate <= today
 */
export function isWithinBackdateWindow(dateStr: string, maxDays = BACKDATE_MAX_DAYS): boolean {
  const target = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const earliest = new Date(today);
  earliest.setDate(today.getDate() - maxDays);

  const tDate = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return tDate >= earliest && tDate <= today;
}

/**
 * Checks if business date string is today
 */
export function isTodayDate(dateStr: string): boolean {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  return dateStr === todayStr;
}
