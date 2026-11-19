/**
 * Keys used in operator visibility settings for Stock taking toolbar buttons.
 * When value is true or key is missing, the button is shown. When false, hidden.
 */
export const STD_STOCK_COUNT_SHOW_PDF = "stdStockCount.showPdf";
export const STD_STOCK_COUNT_SHOW_SAVE = "stdStockCount.showSave";
export const STD_STOCK_COUNT_SHOW_RECONCILE = "stdStockCount.showReconcile";
export const STD_STOCK_COUNT_SHOW_RECORD_SALES = "stdStockCount.showRecordSales";

export function isStdStockCountButtonVisible(
  visibilityState: Record<string, boolean>,
  key: string
): boolean {
  if (key in visibilityState) return visibilityState[key];
  return true;
}
