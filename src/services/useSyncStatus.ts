import { useState, useEffect, useCallback } from "react";
import { outboxEngine } from "./outboxEngine";

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  syncingCount: number;
  lastError: string | null;
  lastSyncedAt: Date | null;
  triggerSync: () => void;
  syncNow: () => Promise<{ synced: number; failed: number }>;
}

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState({
    isOnline: outboxEngine.getIsOnline(),
    pendingCount: 0,
    syncingCount: 0,
    lastError: null as string | null,
    lastSyncedAt: outboxEngine.getLastSyncedAt(),
  });

  useEffect(() => {
    const unsubscribe = outboxEngine.subscribe((updated) => {
      setStatus({
        isOnline: updated.isOnline,
        pendingCount: updated.pendingCount,
        syncingCount: updated.syncingCount,
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

  return {
    isOnline: status.isOnline,
    pendingCount: status.pendingCount,
    syncingCount: status.syncingCount,
    lastError: status.lastError,
    lastSyncedAt: status.lastSyncedAt,
    triggerSync,
    syncNow,
  };
}
