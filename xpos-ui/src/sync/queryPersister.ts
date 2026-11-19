import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import { get, set, del } from "idb-keyval";

const DB_KEY = "xpos-react-query-cache";
export const QUERY_PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

function isIndexedDBAvailable(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
  } catch {
    return false;
  }
}

/**
 * Creates an IndexedDB-backed persister for TanStack Query.
 * Falls back to in-memory storage if IndexedDB is not available (e.g. in tests or private browsing).
 */
export function createIdbPersister(key = DB_KEY) {
  if (isIndexedDBAvailable()) {
    return createAsyncStoragePersister({
      storage: {
        getItem: (k: string) => get<string>(k),
        setItem: (k: string, value: string) => set(k, value),
        removeItem: (k: string) => del(k),
      },
      key,
      throttleTime: 1000,
    });
  }

  // Fallback storage (memory map) for test / non-indexedDB environments
  const memoryStorage = new Map<string, string>();
  return createAsyncStoragePersister({
    storage: {
      getItem: (k: string) => Promise.resolve(memoryStorage.get(k) ?? null),
      setItem: (k: string, value: string) => {
        memoryStorage.set(k, value);
        return Promise.resolve();
      },
      removeItem: (k: string) => {
        memoryStorage.delete(k);
        return Promise.resolve();
      },
    },
    key,
    throttleTime: 0,
  });
}

/**
 * Completely clears the persisted React Query cache in IndexedDB.
 * Called on logout or 401 unauthenticated session expiry.
 */
export async function clearPersistedQueryCache(key = DB_KEY): Promise<void> {
  if (isIndexedDBAvailable()) {
    try {
      await del(key);
    } catch {
      // Ignore errors during cache cleanup
    }
  }
}

export type PersistOptions = PersistQueryClientProviderProps["persistOptions"];

/**
 * Default persist options for PersistQueryClientProvider.
 */
export function getPersistOptions(key = DB_KEY): PersistOptions {
  return {
    persister: createIdbPersister(key),
    maxAge: QUERY_PERSIST_MAX_AGE_MS,
    buster: "v1.0",
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => {
        // Only persist successfully completed queries with data
        return query.state.status === "success" && query.state.data !== undefined;
      },
    },
  };
}
