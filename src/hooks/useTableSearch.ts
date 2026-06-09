import { useMemo } from "react";
import { usePersistedSearch } from "@/hooks/usePersistedSearch";
import { filterRowsBySearch } from "@/utils/tableSearchMatch";
import {
  sortTableRows,
  type SortDirection,
  type SortValueGetter,
} from "@/utils/tableSort";

export interface UseTableSearchOptions<T> {
  /** Override persisted search state (e.g. to drive a fetch-all query before this hook). */
  searchQuery?: string;
  setSearchQuery?: (value: string) => void;
  /** Build searchable text from a row (nested / computed columns). */
  getSearchableText?: (row: T) => string;
  /** Client-side page index when slicing filtered results. */
  page?: number;
  /** Client-side page size when slicing filtered results. */
  size?: number;
  /**
   * Full dataset for cross-page search on server-paginated tables.
   * When search is active, filters `allRows` instead of the current `rows` page.
   */
  allRows?: T[];
  /** Server total when not searching (server-paginated mode). */
  serverTotalElements?: number;
  /** Active sort column key (from useTableSort / useDataTable). */
  sortColumn?: string | null;
  sortDirection?: SortDirection;
  getSortValue?: SortValueGetter<T>;
}

function applySearchAndSort<T>(
  rows: T[],
  searchQuery: string,
  getText: ((row: T) => string) | undefined,
  sortColumn: string | null | undefined,
  sortDirection: SortDirection | undefined,
  getSortValue: SortValueGetter<T> | undefined
): T[] {
  const filtered = filterRowsBySearch(rows, searchQuery, getText);
  if (!sortColumn || !getSortValue) {
    return filtered;
  }
  return sortTableRows(
    filtered,
    { column: sortColumn, direction: sortDirection ?? "asc" },
    getSortValue
  );
}

/**
 * Client-side table filter with optional persisted search (sessionStorage).
 * Pass storageSuffix when a page has multiple search inputs on the same route.
 *
 * Modes:
 * - Simple: filter all `rows`, return every match.
 * - Client-paginated: pass `page` + `size`; `rows` is the full dataset.
 * - Server-paginated: pass `page`, `size`, `allRows`, `serverTotalElements`.
 */
export function useTableSearch<T>(
  rows: T[],
  storageSuffix?: string,
  options?: UseTableSearchOptions<T>
) {
  const [persistedQuery, setPersistedQuery] = usePersistedSearch(storageSuffix);
  const searchQuery = options?.searchQuery ?? persistedQuery;
  const setSearchQuery = options?.setSearchQuery ?? setPersistedQuery;
  const isSearching = searchQuery.trim().length > 0;
  const isSorting = Boolean(options?.sortColumn && options?.getSortValue);
  const useClientPipeline = isSearching || isSorting;

  const { filteredRows, totalElements, allFilteredRows } = useMemo(() => {
    const getText = options?.getSearchableText;
    const page = options?.page;
    const size = options?.size;
    const hasClientPaging = page != null && size != null && size > 0;
    const hasServerPaging =
      hasClientPaging &&
      options?.allRows != null &&
      options.serverTotalElements != null;
    const sortColumn = options?.sortColumn ?? null;
    const sortDirection = options?.sortDirection ?? "asc";
    const getSortValue = options?.getSortValue;

    if (hasServerPaging) {
      if (useClientPipeline && options.allRows) {
        const processed = applySearchAndSort(
          options.allRows,
          searchQuery,
          getText,
          sortColumn,
          sortDirection,
          getSortValue
        );
        const displayRows = processed.slice(
          page! * size!,
          page! * size! + size!
        );
        return {
          filteredRows: displayRows,
          totalElements: processed.length,
          allFilteredRows: processed,
        };
      }
      const displayRows = useClientPipeline
        ? applySearchAndSort(
            rows,
            searchQuery,
            getText,
            sortColumn,
            sortDirection,
            getSortValue
          )
        : rows;
      const total = useClientPipeline
        ? displayRows.length
        : options.serverTotalElements!;
      const paged = useClientPipeline
        ? displayRows.slice(page! * size!, page! * size! + size!)
        : rows;
      return {
        filteredRows: paged,
        totalElements: total,
        allFilteredRows: displayRows,
      };
    }

    if (hasClientPaging) {
      const processed = applySearchAndSort(
        rows,
        searchQuery,
        getText,
        sortColumn,
        sortDirection,
        getSortValue
      );
      const displayRows = processed.slice(page! * size!, page! * size! + size!);
      return {
        filteredRows: displayRows,
        totalElements: processed.length,
        allFilteredRows: processed,
      };
    }

    const processed = applySearchAndSort(
      rows,
      searchQuery,
      getText,
      sortColumn,
      sortDirection,
      getSortValue
    );
    return {
      filteredRows: processed,
      totalElements: processed.length,
      allFilteredRows: processed,
    };
  }, [rows, searchQuery, useClientPipeline, isSearching, isSorting, options]);

  return {
    searchQuery,
    setSearchQuery,
    filteredRows,
    totalElements,
    isSearching,
    isSorting,
    allFilteredRows,
  };
}
