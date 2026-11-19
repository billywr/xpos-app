import { useEffect, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";

let activeRequestCount = 0;
const listeners = new Set<(count: number) => void>();

export function incrementNetworkActivity(): void {
  activeRequestCount += 1;
  listeners.forEach((listener) => listener(activeRequestCount));
}

export function decrementNetworkActivity(): void {
  activeRequestCount = Math.max(0, activeRequestCount - 1);
  listeners.forEach((listener) => listener(activeRequestCount));
}

export function subscribeNetworkActivity(listener: (count: number) => void): () => void {
  listeners.add(listener);
  listener(activeRequestCount);
  return () => {
    listeners.delete(listener);
  };
}

export function getActiveRequestCount(): number {
  return activeRequestCount;
}

/**
 * Hook to monitor all ongoing backend and network activity in the application.
 * Returns true if any active mutation is running, any initial page query is fetching without cached data,
 * or if any explicit direct network activity is active.
 *
 * Background refetches (where cached data is already present) do NOT trigger this indicator,
 * ensuring the top progress bar stops promptly as soon as a save or initial page load completes.
 */
export function useNetworkActivity(): boolean {
  const isMutating = useIsMutating();
  const isPendingQueryFetching = useIsFetching({
    predicate: (query) => {
      // Ignore background refetches when data is already present in cache
      if (query.state.data !== undefined) {
        return false;
      }
      return query.state.status === "pending";
    },
  });
  const [activeRequests, setActiveRequests] = useState<number>(activeRequestCount);

  useEffect(() => {
    return subscribeNetworkActivity(setActiveRequests);
  }, []);

  return activeRequests > 0 || isPendingQueryFetching > 0 || isMutating > 0;
}
