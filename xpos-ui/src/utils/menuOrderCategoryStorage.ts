/**
 * Persistence helpers for the POS Menu Order selected category.
 * Preserves category selection (or 'All') across browser refreshes and tab reloads,
 * and clears on logout.
 */

const STORAGE_PREFIX = "xpos_menu_order_category";
const ALL_CATEGORY_SENTINEL = "__ALL__";

function storageKey(orgId?: string | null): string {
  return orgId ? `${STORAGE_PREFIX}_${orgId}` : STORAGE_PREFIX;
}

/**
 * Get stored category ID for the given org.
 * Returns:
 * - undefined if no category was selected by user in this session (so default can be applied)
 * - null if user explicitly selected 'All'
 * - string categoryId if a specific category was selected
 */
export function getStoredMenuOrderCategory(orgId?: string | null): string | null | undefined {
  try {
    const key = storageKey(orgId);
    let raw = sessionStorage.getItem(key);
    if (raw === null) {
      raw = localStorage.getItem(key);
    }
    // Check unscoped fallback if org-scoped not found
    if (raw === null && orgId) {
      raw = sessionStorage.getItem(STORAGE_PREFIX) ?? localStorage.getItem(STORAGE_PREFIX);
    }

    if (raw === null) {
      return undefined;
    }
    if (raw === ALL_CATEGORY_SENTINEL) {
      return null;
    }
    return raw;
  } catch {
    return undefined;
  }
}

/**
 * Save user category selection (string category ID or null for 'All').
 */
export function setStoredMenuOrderCategory(
  categoryId: string | null,
  orgId?: string | null
): void {
  try {
    const val = categoryId === null ? ALL_CATEGORY_SENTINEL : categoryId;
    if (orgId) {
      const key = storageKey(orgId);
      sessionStorage.setItem(key, val);
      localStorage.setItem(key, val);
    }
    sessionStorage.setItem(STORAGE_PREFIX, val);
    localStorage.setItem(STORAGE_PREFIX, val);
  } catch {
    // Storage unavailable
  }
}

/**
 * Clear all persisted menu order category entries from both sessionStorage and localStorage.
 * Should be called upon logout or session invalidation.
 */
export function clearStoredMenuOrderCategory(): void {
  try {
    const sessionKeys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        sessionKeys.push(key);
      }
    }
    sessionKeys.forEach((k) => sessionStorage.removeItem(k));

    const localKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        localKeys.push(key);
      }
    }
    localKeys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Storage unavailable
  }
}
