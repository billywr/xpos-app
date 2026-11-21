import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export interface UsePersistedTabOptions<T extends string> {
  /** Unique identifier for the tab collection (e.g. "debts-expenses", "org-setup", "inventory-receiving", "catalog", "settings-tabs") */
  tabListId: string;
  /** List of valid tab IDs */
  validTabs: readonly T[] | T[];
  /** Default tab ID if none is set in URL or storage */
  defaultTab: T;
  /** Optional URL query parameter name, defaults to "tab" */
  paramName?: string;
  /** Optional normalizer function for legacy/alias query values (e.g. "goods-receipt" -> "stock") */
  normalizeTab?: (raw: string | null) => string | null;
}

const STORAGE_PREFIX = "xpos-tab:";

export function getStoredTab(tabListId: string): string | null {
  try {
    return (
      sessionStorage.getItem(`${STORAGE_PREFIX}${tabListId}`) ??
      localStorage.getItem(`${STORAGE_PREFIX}${tabListId}`) ??
      null
    );
  } catch {
    return null;
  }
}

export function setStoredTab(tabListId: string, tabId: string): void {
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${tabListId}`, tabId);
    localStorage.setItem(`${STORAGE_PREFIX}${tabListId}`, tabId);
  } catch {
    // Storage access may be restricted
  }
}

export function clearStoredTab(tabListId: string): void {
  try {
    sessionStorage.removeItem(`${STORAGE_PREFIX}${tabListId}`);
    localStorage.removeItem(`${STORAGE_PREFIX}${tabListId}`);
  } catch {
    // Storage access may be restricted
  }
}

/**
 * Hook to manage active tab with persistence across page refreshes and browser sessions.
 * Resolves active tab with priority:
 * 1. URL search parameter (?tab=...)
 * 2. Session / Local storage fallback (xpos-tab:<tabListId>)
 * 3. Default tab
 *
 * Automatically synchronizes tab changes to both URL and storage.
 */
export function usePersistedTab<T extends string>({
  tabListId,
  validTabs,
  defaultTab,
  paramName = "tab",
  normalizeTab,
}: UsePersistedTabOptions<T>): [T, (nextTab: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParamRaw = searchParams.get(paramName);
  const normalizedParam = normalizeTab ? normalizeTab(tabParamRaw) : tabParamRaw;

  // Resolve active tab in priority order:
  // 1. URL search parameter
  // 2. Storage fallback (sessionStorage / localStorage)
  // 3. defaultTab
  const activeTab = useMemo((): T => {
    if (normalizedParam && (validTabs as readonly string[]).includes(normalizedParam)) {
      return normalizedParam as T;
    }
    const stored = getStoredTab(tabListId);
    if (stored && (validTabs as readonly string[]).includes(stored)) {
      return stored as T;
    }
    return defaultTab;
  }, [normalizedParam, validTabs, tabListId, defaultTab]);

  // Sync to storage & ensure URL reflects active tab
  useEffect(() => {
    setStoredTab(tabListId, activeTab);
    const currentInUrl = searchParams.get(paramName);
    if (currentInUrl !== activeTab) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(paramName, activeTab);
          return next;
        },
        { replace: true }
      );
    }
  }, [activeTab, tabListId, paramName, searchParams, setSearchParams]);

  const setTab = useCallback(
    (nextTab: T) => {
      setStoredTab(tabListId, nextTab);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(paramName, nextTab);
          return next;
        },
        { replace: false }
      );
    },
    [tabListId, paramName, setSearchParams]
  );

  return [activeTab, setTab];
}
