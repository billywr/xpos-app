/**
 * Keys used in operator visibility settings for Menu Order screen options.
 * When value is true or key is missing, the option is shown. When false, hidden.
 */
export const MENU_ORDER_SHOW_ORDER_TYPE = "menuOrder.showOrderType";
export const MENU_ORDER_SHOW_TABLE_SELECT = "menuOrder.showTableSelect";
export const MENU_ORDER_SHOW_ITEM_LIST = "menuOrder.showItemList";

export function isMenuOrderOptionVisible(
  visibilityState: Record<string, boolean>,
  key: string
): boolean {
  if (key in visibilityState) return visibilityState[key];
  return true;
}
