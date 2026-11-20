import { useEffect } from "react";
import { useTableSearch, type UseTableSearchOptions } from "@/hooks/useTableSearch";
import { useTableSort } from "@/hooks/useTableSort";
import type { SortValueGetter } from "@/utils/tableSort";

export type SortAccessors<T> = Record<string, (row: T) => unknown>;

export interface UseDataTableOptions<T>
  extends Omit<
    UseTableSearchOptions<T>,
    "sortColumn" | "sortDirection" | "getSortValue"
  > {
  sortAccessors?: SortAccessors<T>;
  setPage?: (page: number) => void;
  getDefaultDirection?: (column: string) => import("@/utils/tableSort").SortDirection;
}

/**
 * Search + sort + optional client/server pagination for datatables.
 */
export function useDataTable<T>(
  rows: T[],
  storageSuffix?: string,
  options?: UseDataTableOptions<T>
) {
  const { sortAccessors, setPage, getDefaultDirection, ...searchOptions } =
    options ?? {};
  const sort = useTableSort(storageSuffix, { getDefaultDirection });

  const getSortValue: SortValueGetter<T> = (row, column) => {
    const accessor = sortAccessors?.[column];
    return accessor ? accessor(row) : null;
  };

  const search = useTableSearch(rows, storageSuffix, {
    ...searchOptions,
    sortAccessors,
    sortColumn: sort.sortColumn,
    sortDirection: sort.sortDirection,
    getSortValue: sortAccessors ? getSortValue : undefined,
  });

  useEffect(() => {
    setPage?.(0);
  }, [search.searchQuery, sort.sortColumn, sort.sortDirection, options?.size, setPage]);

  return {
    ...search,
    sortColumn: sort.sortColumn,
    sortDirection: sort.sortDirection,
    toggleSort: sort.toggleSort,
    setSort: sort.setSort,
    isSortActive: sort.isSortActive,
  };
}
