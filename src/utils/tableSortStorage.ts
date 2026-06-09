import type { SortDirection } from "@/utils/tableSort";

const STORAGE_PREFIX = "xpos-table-sort:";

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

export interface StoredTableSort {
  column: string;
  direction: SortDirection;
}

export function getStoredTableSort(key: string): StoredTableSort | null {
  try {
    const raw = sessionStorage.getItem(storageKey(key));
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed != null &&
      typeof parsed === "object" &&
      "column" in parsed &&
      "direction" in parsed &&
      typeof (parsed as StoredTableSort).column === "string" &&
      ((parsed as StoredTableSort).direction === "asc" ||
        (parsed as StoredTableSort).direction === "desc")
    ) {
      return parsed as StoredTableSort;
    }
    return null;
  } catch {
    return null;
  }
}

export function setStoredTableSort(key: string, sort: StoredTableSort | null): void {
  try {
    if (sort) {
      sessionStorage.setItem(storageKey(key), JSON.stringify(sort));
    } else {
      sessionStorage.removeItem(storageKey(key));
    }
  } catch {
    // sessionStorage unavailable
  }
}

export function clearAllStoredTableSort(): void {
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
}
