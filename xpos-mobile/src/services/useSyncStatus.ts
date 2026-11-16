import { useState, useEffect, useCallback } from "react";
import { outboxEngine, OutboxMutation } from "./outboxEngine";

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  syncingCount: number;
  committedCount: number;
  failedCount: number;
  lastError: string | null;
  lastSyncedAt: Date | null;
  triggerSync: () => void;
  syncNow: () => Promise<{ synced: number; failed: number }>;
  getRecentMutations: (limit?: number) => Promise<OutboxMutation[]>;
  retryMutation: (id: string) => Promise<void>;
}

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState({
    isOnline: outboxEngine.getIsOnline(),
    pendingCount: 0,
    syncingCount: 0,
    committedCount: 0,
    failedCount: 0,
    lastError: null as string | null,
    lastSyncedAt: null as Date | null,
  });

  useEffect(() => {
    void outboxEngine.getLastSyncedAt().then((date) => {
      if (date) {
        setStatus((prev) => ({ ...prev, lastSyncedAt: date }));
      }
    });

    const unsubscribe = outboxEngine.subscribe((updated) => {
      setStatus({
        isOnline: updated.isOnline,
        pendingCount: updated.pendingCount,
        syncingCount: updated.syncingCount,
        committedCount: updated.committedCount,
        failedCount: updated.failedCount,
        lastError: updated.lastError,
        lastSyncedAt: updated.lastSyncedAt,
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const triggerSync = useCallback(() => {
    void outboxEngine.processQueue();
  }, []);

  const syncNow = useCallback(async () => {
    return await outboxEngine.processQueue();
  }, []);

  const getRecentMutations = useCallback((limit = 50) => {
    return outboxEngine.getRecentMutations(limit);
  }, []);

  const retryMutation = useCallback(async (id: string) => {
    await outboxEngine.retryMutation(id);
  }, []);

  return {
    isOnline: status.isOnline,
    pendingCount: status.pendingCount,
    syncingCount: status.syncingCount,
    committedCount: status.committedCount,
    failedCount: status.failedCount,
    lastError: status.lastError,
    lastSyncedAt: status.lastSyncedAt,
    triggerSync,
    syncNow,
    getRecentMutations,
    retryMutation,
  };
}
