import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import type { SortDirection } from "@/utils/tableSort";
import {
  getStoredTableSort,
  setStoredTableSort,
} from "@/utils/tableSortStorage";

function buildStorageKey(pathname: string, storageSuffix?: string): string {
  return storageSuffix ? `${pathname}::${storageSuffix}` : pathname;
}

export interface UseTableSortOptions {
  getDefaultDirection?: (column: string) => SortDirection;
}

export function useTableSort(
  storageSuffix?: string,
  options?: UseTableSortOptions
) {
  const { pathname } = useLocation();
  const storageKey = buildStorageKey(pathname, storageSuffix);
  const stored = getStoredTableSort(storageKey);

  const [sortColumn, setSortColumn] = useState<string | null>(
    stored?.column ?? null
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    stored?.direction ?? "asc"
  );

  useEffect(() => {
    const next = getStoredTableSort(storageKey);
    setSortColumn(next?.column ?? null);
    setSortDirection(next?.direction ?? "asc");
  }, [storageKey]);

  const toggleSort = useCallback(
    (column: string) => {
      if (sortColumn === column) {
        const nextDirection: SortDirection =
          sortDirection === "asc" ? "desc" : "asc";
        setSortDirection(nextDirection);
        setStoredTableSort(storageKey, { column, direction: nextDirection });
        return;
      }
      const initialDirection =
        options?.getDefaultDirection?.(column) ?? "asc";
      setSortColumn(column);
      setSortDirection(initialDirection);
      setStoredTableSort(storageKey, { column, direction: initialDirection });
    },
    [sortColumn, sortDirection, storageKey, options]
  );

  const setSort = useCallback(
    (column: string | null, direction: SortDirection = "asc") => {
      setSortColumn(column);
      setSortDirection(direction);
      if (column) {
        setStoredTableSort(storageKey, { column, direction });
      } else {
        setStoredTableSort(storageKey, null);
      }
    },
    [storageKey]
  );

  const isSortActive = useCallback(
    (column: string) => sortColumn === column,
    [sortColumn]
  );

  return {
    sortColumn,
    sortDirection,
    toggleSort,
    setSort,
    isSortActive,
  };
}
