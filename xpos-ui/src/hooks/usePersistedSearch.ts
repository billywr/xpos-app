import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  getStoredTableSearch,
  setStoredTableSearch,
} from "@/utils/tableSearchStorage";

/**
 * Search string persisted in sessionStorage until cleared or logout.
 * Key = route pathname, or pathname + suffix when multiple searches share a screen.
 */
export function usePersistedSearch(storageSuffix?: string) {
  const { pathname } = useLocation();
  const storageKey = storageSuffix ? `${pathname}::${storageSuffix}` : pathname;

  const [query, setQueryState] = useState(() => getStoredTableSearch(storageKey));

  useEffect(() => {
    setQueryState(getStoredTableSearch(storageKey));
  }, [storageKey]);

  const setQuery = useCallback(
    (value: string) => {
      setQueryState(value);
      setStoredTableSearch(storageKey, value);
    },
    [storageKey]
  );

  return [query, setQuery] as const;
}
