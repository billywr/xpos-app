import { fetchInventoryReport } from "@/api/inventoryReport";

const INVENTORY_PAGE_SIZE = 200;

/**
 * Item IDs with on-hand quantity &gt; 0 in at least one of the given branches (inventory report).
 */
export async function fetchItemIdsWithPositiveOnHand(
  token: string | null,
  orgId: string,
  branchIds: string[]
): Promise<Set<string>> {
  const ids = new Set<string>();
  if (branchIds.length === 0) {
    return ids;
  }
  for (const branchId of branchIds) {
    let page = 0;
    let totalPages = 1;
    while (page < totalPages) {
      const res = await fetchInventoryReport(token, orgId, branchId, {
        page,
        size: INVENTORY_PAGE_SIZE,
      });
      totalPages = res.totalPages;
      for (const line of res.content) {
        if (line.onHandQty > 0) {
          ids.add(line.itemId);
        }
      }
      page += 1;
    }
  }
  return ids;
}

const ITEM_TYPES_REQUIRING_ON_HAND: ReadonlySet<string> = new Set(["STOCK", "MENU"]);

/**
 * Sellable quantity items (STOCK/MENU or inventory-tracked) must have on-hand &gt; 0 in scope.
 * SERVICE, BUNDLE (unless tracked), etc. stay eligible without a stock row.
 */
export function itemIsInStockForPriceListAdd(
  item: { id: string; trackInventory: boolean; itemType: string },
  positiveHandIds: Set<string>
): boolean {
  const mustHavePositiveOnHand =
    item.trackInventory || ITEM_TYPES_REQUIRING_ON_HAND.has(item.itemType);
  if (!mustHavePositiveOnHand) {
    return true;
  }
  return positiveHandIds.has(item.id);
}
