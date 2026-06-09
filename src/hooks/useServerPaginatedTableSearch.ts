import { useQuery, type QueryKey } from "@tanstack/react-query";
import { useEffect } from "react";
import { TABLE_SEARCH_FETCH_SIZE } from "@/constants/tableSearch";
import { usePersistedSearch } from "@/hooks/usePersistedSearch";
import { useTableSearch } from "@/hooks/useTableSearch";
import { useTableSort } from "@/hooks/useTableSort";
import type { SortAccessors } from "@/hooks/useDataTable";

type SearchAllPage<T> = {
  content: T[];
};

export interface UseServerPaginatedTableSearchParams<T> {
  pageRows: T[];
  serverTotalElements: number;
  page: number;
  size: number;
  setPage: (page: number) => void;
  storageSuffix?: string;
  searchAllQueryKey: QueryKey;
  searchAllQueryFn: (size: number) => Promise<SearchAllPage<T>>;
  searchAllEnabled: boolean;
  getSearchableText?: (row: T) => string;
  sortAccessors?: SortAccessors<T>;
}

/**
 * Server-paginated tables: search/sort across all pages by fetching up to
 * TABLE_SEARCH_FETCH_SIZE rows when the user searches or sorts.
 */
export function useServerPaginatedTableSearch<T>({
  pageRows,
  serverTotalElements,
  page,
  size,
  setPage,
  storageSuffix,
  searchAllQueryKey,
  searchAllQueryFn,
  searchAllEnabled,
  getSearchableText,
  sortAccessors,
}: UseServerPaginatedTableSearchParams<T>) {
  const [searchQuery, setSearchQuery] = usePersistedSearch(storageSuffix);
  const { sortColumn, sortDirection, toggleSort, isSortActive } =
    useTableSort(storageSuffix);
  const needsFullDataset =
    searchQuery.trim().length > 0 || sortColumn != null;

  const { data: allRowsData, isFetching: isFetchingAllRows } = useQuery({
    queryKey: [...searchAllQueryKey, "table-search-all"],
    queryFn: () => searchAllQueryFn(TABLE_SEARCH_FETCH_SIZE),
    enabled: searchAllEnabled && needsFullDataset,
    staleTime: 30_000,
  });

  const table = useTableSearch(pageRows, storageSuffix, {
    searchQuery,
    setSearchQuery,
    page,
    size,
    allRows: needsFullDataset ? allRowsData?.content : undefined,
    serverTotalElements,
    getSearchableText,
    sortAccessors,
    sortColumn,
    sortDirection,
    getSortValue: sortAccessors
      ? (row, column) => sortAccessors[column]?.(row) ?? null
      : undefined,
  });

  useEffect(() => {
    setPage(0);
  }, [searchQuery, sortColumn, sortDirection, size, setPage]);

  return {
    ...table,
    sortColumn,
    sortDirection,
    toggleSort,
    isSortActive,
    isFetchingAllRows: needsFullDataset && isFetchingAllRows,
  };
}
