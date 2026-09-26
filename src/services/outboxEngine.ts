import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { getDatabase, withTransaction } from "@/db/sqlite";
import { generateUuid } from "@/utils/uuid";
import { apiFetch } from "@/api/client";
import { storage } from "@/utils/storage";

export type OutboxStatus = "PENDING" | "SYNCING" | "COMMITTED" | "FAILED" | "CONFLICT";

export interface OutboxMutation {
  id: string;
  client_request_id: string;
  org_id: string;
  branch_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  endpoint: string;
  http_method: string;
  payload_json: string;
  status: OutboxStatus;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

export type OutboxListener = (status: {
  pendingCount: number;
  syncingCount: number;
  committedCount: number;
  failedCount: number;
  isOnline: boolean;
  lastError: string | null;
  lastSyncedAt: Date | null;
}) => void;

class OutboxEngine {
  private isProcessing = false;
  private isOnline = true;
  private listeners: Set<OutboxListener> = new Set();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastError: string | null = null;
  private lastSyncedAt: Date | null = null;

  constructor() {
    this.initNetworkListener();
    void this.getLastSyncedAt();
  }

  public subscribe(listener: OutboxListener): () => void {
    this.listeners.add(listener);
    this.notifyListeners();
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async getLastSyncedAt(): Promise<Date | null> {
    if (this.lastSyncedAt) return this.lastSyncedAt;
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<{ last_synced: string }>(
        `SELECT MAX(synced_at) as last_synced FROM outbox_mutations WHERE status = 'COMMITTED'`
      );
      if (row?.last_synced) {
        this.lastSyncedAt = new Date(row.last_synced);
        return this.lastSyncedAt;
      }
    } catch {}
    return null;
  }

  private async notifyListeners() {
    try {
      const stats = await this.getStats();
      const lastSynced = this.lastSyncedAt || (await this.getLastSyncedAt());
      this.listeners.forEach((fn) =>
        fn({
          pendingCount: stats.pending,
          syncingCount: stats.syncing,
          committedCount: stats.committed,
          failedCount: stats.failed,
          isOnline: this.isOnline,
          lastError: this.lastError,
          lastSyncedAt: lastSynced,
        })
      );
    } catch {
      // Ignored during shutdown or hot reload
    }
  }

  private initNetworkListener() {
    NetInfo.addEventListener((state: NetInfoState) => {
      const connected = Boolean(state.isConnected && (state.isInternetReachable ?? true));
      const becameOnline = !this.isOnline && connected;
      this.isOnline = connected;
      this.notifyListeners();
      if (becameOnline) {
        void this.processQueue();
      }
    });

    // Start background sync timer every 5s for near-instant delta synchronization
    if (!this.intervalId) {
      this.intervalId = setInterval(() => {
        if (this.isOnline && !this.isProcessing) {
          void this.processQueue();
        }
      }, 5000);
    }
  }

  public async getStats(): Promise<{ pending: number; syncing: number; committed: number; failed: number }> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count FROM outbox_mutations GROUP BY status`
    );
    let pending = 0;
    let syncing = 0;
    let committed = 0;
    let failed = 0;
    rows.forEach((r) => {
      if (r.status === "PENDING") pending = r.count;
      else if (r.status === "SYNCING") syncing = r.count;
      else if (r.status === "COMMITTED") committed = r.count;
      else if (r.status === "FAILED") failed = r.count;
    });
    return { pending, syncing, committed, failed };
  }

  public async getRecentMutations(limit = 15): Promise<OutboxMutation[]> {
    try {
      const db = await getDatabase();
      return await db.getAllAsync<OutboxMutation>(
        `SELECT * FROM outbox_mutations ORDER BY created_at DESC LIMIT ?`,
        [limit]
      );
    } catch {
      return [];
    }
  }

  /**
   * Enqueue a new mutation into outbox table inside an existing or new SQLite transaction.
   * Performs delta coalescing: if a mutation for the same entity is already PENDING,
   * updates the payload and timestamp instead of appending redundant requests.
   */
  public async enqueue(
    mutation: {
      orgId: string;
      branchId: string;
      entityType: string;
      entityId: string;
      action: string;
      endpoint: string;
      httpMethod: string;
      payloadJson: string;
      clientRequestId?: string;
    },
    customDb?: any
  ): Promise<string> {
    const clientRequestId = mutation.clientRequestId || generateUuid();
    const now = new Date().toISOString();

    const runner = async (db: any): Promise<string> => {
      // Delta Coalescing: Check if an identical entity already has a PENDING mutation
      const existingPending = (await db.getFirstAsync(
        `SELECT id, client_request_id FROM outbox_mutations 
         WHERE org_id = ? AND entity_type = ? AND entity_id = ? AND status = 'PENDING'
         ORDER BY created_at DESC LIMIT 1`,
        [mutation.orgId, mutation.entityType, mutation.entityId]
      )) as { id: string; client_request_id: string } | null;

      if (existingPending) {
        // Coalesce into existing pending mutation: update payload, endpoint, action, and timestamp
        await db.runAsync(
          `UPDATE outbox_mutations SET 
             action = ?,
             endpoint = ?,
             http_method = ?,
             payload_json = ?,
             updated_at = ?
           WHERE id = ?`,
          [
            mutation.action,
            mutation.endpoint,
            mutation.httpMethod,
            mutation.payloadJson,
            now,
            existingPending.id,
          ]
        );
        return existingPending.client_request_id;
      } else {
        const id = generateUuid();
        await db.runAsync(
          `INSERT INTO outbox_mutations (
            id, client_request_id, org_id, branch_id, entity_type, entity_id, action,
            endpoint, http_method, payload_json, status, retry_count, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?)`,
          [
            id,
            clientRequestId,
            mutation.orgId,
            mutation.branchId,
            mutation.entityType,
            mutation.entityId,
            mutation.action,
            mutation.endpoint,
            mutation.httpMethod,
            mutation.payloadJson,
            now,
            now,
          ]
        );
        return clientRequestId;
      }
    };

    let resultRequestId = clientRequestId;
    if (customDb) {
      resultRequestId = await runner(customDb);
    } else {
      await withTransaction(async (db) => {
        resultRequestId = await runner(db);
      });
    }

    this.notifyListeners();

    // Trigger process immediately if online
    if (this.isOnline) {
      setTimeout(() => {
        void this.processQueue();
      }, 50);
    }

    return resultRequestId;
  }

  /**
   * Process pending items in outbox queue sequentially or in coalesced batches.
   * Returns counts of synced and failed mutations.
   */
  public async processQueue(): Promise<{ synced: number; failed: number }> {
    if (this.isProcessing) return { synced: 0, failed: 0 };
    this.isProcessing = true;
    let synced = 0;
    let failed = 0;

    try {
      const token = await storage.getAuthToken();
      if (!token) {
        return { synced: 0, failed: 0 };
      }

      const db = await getDatabase();
      const pendingList = await db.getAllAsync<OutboxMutation>(
        `SELECT * FROM outbox_mutations 
         WHERE status IN ('PENDING', 'SYNCING') 
         ORDER BY created_at ASC 
         LIMIT 20`
      );

      if (pendingList.length === 0) {
        return { synced: 0, failed: 0 };
      }

      for (const item of pendingList) {
        const now = new Date().toISOString();
        await db.runAsync(
          `UPDATE outbox_mutations SET status = 'SYNCING', updated_at = ? WHERE id = ?`,
          [now, item.id]
        );
        this.notifyListeners();

        try {
          const body = item.payload_json ? JSON.parse(item.payload_json) : undefined;
          const res = await apiFetch<any>(item.endpoint, {
            method: item.http_method,
            token,
            requestId: item.client_request_id,
            body,
          });

          // Mark COMMITTED
          const syncedAt = new Date().toISOString();
          await db.runAsync(
            `UPDATE outbox_mutations SET status = 'COMMITTED', synced_at = ?, updated_at = ? WHERE id = ?`,
            [syncedAt, syncedAt, item.id]
          );

          // Update associated entity if stock count
          if (item.entity_type === "STOCK_COUNT_SAVE") {
            await db.runAsync(
              `UPDATE stock_count_lines SET sync_status = 'COMMITTED' 
               WHERE branch_id = ? AND item_id = ? AND sync_status = 'SYNCING'`,
              [item.branch_id, item.entity_id]
            );
          } else if (item.entity_type === "CATALOG_ITEM_CREATE" && res?.id && res.id !== item.entity_id) {
            // Update local item ID from client temp UUID to server UUID
            await db.runAsync(`UPDATE items SET id = ?, updated_at = ? WHERE id = ?`, [res.id, syncedAt, item.entity_id]);
          }

          synced++;
          this.lastSyncedAt = new Date();
          this.lastError = null;
        } catch (err: any) {
          failed++;
          const status = err?.status ?? 0;
          const errMsg = err?.data?.message || err?.message || "Sync failed";
          this.lastError = errMsg;

          const isUnrecoverable = status >= 400 && status < 500 && status !== 408;

          if (isUnrecoverable) {
            // Bad request, unrecoverable validation error
            await db.runAsync(
              `UPDATE outbox_mutations SET status = 'FAILED', last_error = ?, updated_at = ? WHERE id = ?`,
              [errMsg, new Date().toISOString(), item.id]
            );
            if (item.entity_type === "STOCK_COUNT_SAVE") {
              await db.runAsync(
                `UPDATE stock_count_lines SET sync_status = 'FAILED' 
                 WHERE branch_id = ? AND item_id = ?`,
                [item.branch_id, item.entity_id]
              );
            }
          } else {
            // Transient network failure or 5xx: schedule retry with backoff
            await db.runAsync(
              `UPDATE outbox_mutations 
               SET status = 'PENDING', retry_count = retry_count + 1, last_error = ?, updated_at = ? 
               WHERE id = ?`,
              [errMsg, new Date().toISOString(), item.id]
            );
            // Break loop to prevent hammering during offline/network outage
            break;
          }
        }
      }
    } finally {
      this.isProcessing = false;
      this.notifyListeners();
    }

    return { synced, failed };
  }

  public getIsOnline(): boolean {
    return this.isOnline;
  }
}

export const outboxEngine = new OutboxEngine();
