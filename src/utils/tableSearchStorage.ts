import { clearAllStoredTableSort } from "@/utils/tableSortStorage";

const STORAGE_PREFIX = "xpos-table-search:";

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

export function getStoredTableSearch(key: string): string {
  try {
    return sessionStorage.getItem(storageKey(key)) ?? "";
  } catch {
    return "";
  }
}

export function setStoredTableSearch(key: string, value: string): void {
  try {
    if (value) {
      sessionStorage.setItem(storageKey(key), value);
    } else {
      sessionStorage.removeItem(storageKey(key));
    }
  } catch {
    // sessionStorage unavailable
  }
}

export function clearAllStoredTableSearch(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // sessionStorage unavailable
  }
  clearAllStoredTableSort();
}
