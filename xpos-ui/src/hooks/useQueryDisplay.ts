import type { UseQueryResult } from "@tanstack/react-query";

export interface QueryDisplayState {
  /** True only on first fetch with no cached data — show skeleton. */
  isInitialLoad: boolean;
  /** True when refetching with cached data visible — subtle refresh indicator only. */
  isRefreshing: boolean;
  /** True when any data (including stale cache) is available. */
  hasData: boolean;
}

/**
 * Derives display flags from a React Query result so pages avoid full-page loading gates.
 */
export function useQueryDisplay<TData>(
  query: Pick<UseQueryResult<TData>, "isPending" | "isFetching" | "data">
): QueryDisplayState {
  const { isPending, isFetching, data } = query;
  const hasData = data !== undefined;

  return {
    isInitialLoad: isPending && !hasData,
    isRefreshing: isFetching && hasData,
    hasData,
  };
}
