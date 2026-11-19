/**
 * Persistence helpers for stock taking and stock receiving dates so they survive
 * browser refreshes and logout/login sessions until explicitly changed.
 */

const STD_STOCK_COUNT_DATE_KEY = "xpos_stock_count_selected_date";
const GRN_RECEIVED_AT_KEY = "xpos_grn_selected_received_at";
const GRN_FILTER_RANGE_KEY = "xpos_grn_filter";

/** Get stored date (YYYY-MM-DD) for stock count sheet. */
export function getSavedStockCountDate(orgId?: string, branchId?: string): string | null {
  try {
    if (orgId && branchId) {
      const scoped = localStorage.getItem(`${STD_STOCK_COUNT_DATE_KEY}_${orgId}_${branchId}`);
      if (scoped && /^\d{4}-\d{2}-\d{2}$/.test(scoped)) {
        return scoped;
      }
    }
    const globalVal = localStorage.getItem(STD_STOCK_COUNT_DATE_KEY);
    if (globalVal && /^\d{4}-\d{2}-\d{2}$/.test(globalVal)) {
      return globalVal;
    }
  } catch {}
  return null;
}

/** Save chosen date (YYYY-MM-DD) for stock count sheet. */
export function saveStockCountDate(dateStr: string, orgId?: string, branchId?: string): void {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
    if (orgId && branchId) {
      localStorage.setItem(`${STD_STOCK_COUNT_DATE_KEY}_${orgId}_${branchId}`, dateStr);
    }
    localStorage.setItem(STD_STOCK_COUNT_DATE_KEY, dateStr);
  } catch {}
}

/** Get stored receivedAt (YYYY-MM-DDTHH:mm or ISO) for new stock receipts. */
export function getSavedGoodsReceiptReceivedAt(orgId?: string, branchId?: string): string | null {
  try {
    if (orgId && branchId) {
      const scoped = localStorage.getItem(`${GRN_RECEIVED_AT_KEY}_${orgId}_${branchId}`);
      if (scoped) return scoped;
    }
    const globalVal = localStorage.getItem(GRN_RECEIVED_AT_KEY);
    if (globalVal) return globalVal;
  } catch {}
  return null;
}

/** Save chosen receivedAt for new stock receipts. */
export function saveGoodsReceiptReceivedAt(receivedAt: string, orgId?: string, branchId?: string): void {
  try {
    if (!receivedAt) return;
    if (orgId && branchId) {
      localStorage.setItem(`${GRN_RECEIVED_AT_KEY}_${orgId}_${branchId}`, receivedAt);
    }
    localStorage.setItem(GRN_RECEIVED_AT_KEY, receivedAt);
  } catch {}
}

export interface GrnFilterRange {
  preset: string | null;
  startDate: string | null;
  endDate: string | null;
}

/** Get stored goods receipt filter preset & dates. */
export function getSavedGoodsReceiptFilterRange(orgId?: string, branchId?: string): GrnFilterRange {
  try {
    const key = orgId && branchId ? `${GRN_FILTER_RANGE_KEY}_${orgId}_${branchId}` : GRN_FILTER_RANGE_KEY;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        preset: typeof parsed.preset === "string" ? parsed.preset : null,
        startDate: typeof parsed.startDate === "string" ? parsed.startDate : null,
        endDate: typeof parsed.endDate === "string" ? parsed.endDate : null,
      };
    }
  } catch {}
  return { preset: null, startDate: null, endDate: null };
}

/** Save goods receipt filter preset & dates. */
export function saveGoodsReceiptFilterRange(
  filter: { preset: string; startDate: string; endDate: string },
  orgId?: string,
  branchId?: string
): void {
  try {
    const json = JSON.stringify(filter);
    if (orgId && branchId) {
      localStorage.setItem(`${GRN_FILTER_RANGE_KEY}_${orgId}_${branchId}`, json);
    }
    localStorage.setItem(GRN_FILTER_RANGE_KEY, json);
  } catch {}
}

/** Clear all stored date persistence keys (for stock taking and stock receipts). */
export function clearAllStoredDatePersistence(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith(STD_STOCK_COUNT_DATE_KEY) ||
          key.startsWith(GRN_RECEIVED_AT_KEY) ||
          key.startsWith(GRN_FILTER_RANGE_KEY))
      ) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {}
}

