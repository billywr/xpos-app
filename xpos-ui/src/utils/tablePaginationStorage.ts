/**
 * Persistence helpers for table pagination (page size / rows per page).
 * Preserves user-selected page sizes across browser refreshes and tab reloads,
 * and clears on logout.
 */

const STORAGE_PREFIX = "xpos-table-page-size:";

function storageKey(key?: string): string {
  return key ? `${STORAGE_PREFIX}${key}` : `${STORAGE_PREFIX}global`;
}

function resolveClosestOption(size: number, sizeOptions: number[]): number {
  if (sizeOptions.length === 0) return size;
  if (sizeOptions.includes(size)) return size;

  let closest = sizeOptions[0];
  let minDiff = Math.abs(size - closest);
  for (let i = 1; i < sizeOptions.length; i++) {
    const diff = Math.abs(size - sizeOptions[i]);
    if (diff < minDiff) {
      minDiff = diff;
      closest = sizeOptions[i];
    }
  }
  return closest;
}

function readStorageValue(key: string): number | null {
  try {
    const raw = sessionStorage.getItem(key) ?? localStorage.getItem(key);
    if (!raw) return null;
    const parsed = parseInt(raw, 10);
    return !isNaN(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Returns whether a stored page size exists for the specific table or globally.
 */
export function hasStoredTablePageSize(tableKey?: string): boolean {
  try {
    if (tableKey) {
      const tableVal = readStorageValue(storageKey(tableKey));
      if (tableVal !== null) return true;
    }
    const globalVal = readStorageValue(storageKey("global"));
    return globalVal !== null;
  } catch {
    return false;
  }
}

/**
 * Get stored page size for a table or global fallback.
 */
export function getStoredTablePageSize(
  tableKey?: string,
  fallbackSize = 25,
  sizeOptions?: number[]
): number {
  try {
    let size: number | null = null;
    if (tableKey) {
      size = readStorageValue(storageKey(tableKey));
    }
    if (size === null) {
      size = readStorageValue(storageKey("global"));
    }

    if (size !== null) {
      if (sizeOptions && sizeOptions.length > 0) {
        return resolveClosestOption(size, sizeOptions);
      }
      return size;
    }
  } catch {
    // Storage unavailable
  }

  return fallbackSize;
}

/**
 * Persist user-selected page size for a specific table and update global preference.
 */
export function setStoredTablePageSize(size: number, tableKey?: string): void {
  if (typeof size !== "number" || isNaN(size) || size <= 0) return;

  const val = String(size);
  try {
    // Always update global system-wide preference
    const globalKey = storageKey("global");
    sessionStorage.setItem(globalKey, val);
    localStorage.setItem(globalKey, val);

    // If specific table key is provided, store table-specific override
    if (tableKey && tableKey !== "global") {
      const specificKey = storageKey(tableKey);
      sessionStorage.setItem(specificKey, val);
      localStorage.setItem(specificKey, val);
    }
  } catch {
    // Storage unavailable
  }
}

/**
 * Clear all persisted pagination entries from both sessionStorage and localStorage.
 * Should be called upon logout or session invalidation.
 */
export function clearAllStoredTablePageSize(): void {
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
