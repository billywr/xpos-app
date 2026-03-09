/**
 * Keys for per-screen barcode visibility in Admin / Operator settings.
 * When value is true or key is missing, barcode feature is shown. When false, hidden.
 */
export const BARCODE_GOODS_RECEIPT = "barcode.goodsReceipt";
export const BARCODE_ITEMS = "barcode.items";
export const BARCODE_MENU_ORDER = "barcode.menuOrder";

export function isBarcodeVisible(
  visibilityState: Record<string, boolean>,
  key: string
): boolean {
  if (key in visibilityState) return visibilityState[key];
  return true;
}
