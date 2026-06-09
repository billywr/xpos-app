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

export function useTableSort(storageSuffix?: string) {
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
      setSortColumn(column);
      setSortDirection("asc");
      setStoredTableSort(storageKey, { column, direction: "asc" });
    },
    [sortColumn, sortDirection, storageKey]
  );

  const isSortActive = useCallback(
    (column: string) => sortColumn === column,
    [sortColumn]
  );

  return {
    sortColumn,
    sortDirection,
    toggleSort,
    isSortActive,
  };
}
