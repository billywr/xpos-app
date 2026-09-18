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
 * Returns true if any React Query fetching/mutating is running, or if any apiFetch HTTP call is active.
 */
export function useNetworkActivity(): boolean {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const [activeRequests, setActiveRequests] = useState<number>(activeRequestCount);

  useEffect(() => {
    return subscribeNetworkActivity(setActiveRequests);
  }, []);

  return activeRequests > 0 || isFetching > 0 || isMutating > 0;
}
