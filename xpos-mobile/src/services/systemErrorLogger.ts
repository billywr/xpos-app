import { getDatabase, withTransaction } from "@/db/sqlite";
import { generateUuid } from "@/utils/uuid";

export interface SystemErrorLog {
  id: string;
  error_code: string;
  message: string;
  status: number;
  source: string | null;
  request_id: string | null;
  details_json: string | null;
  created_at: string;
}

export type ErrorLogListener = (errors: SystemErrorLog[]) => void;

class SystemErrorLogger {
  private listeners: Set<ErrorLogListener> = new Set();
  private maxLogs = 10;

  public subscribe(listener: ErrorLogListener): () => void {
    this.listeners.add(listener);
    void this.getRecentErrors().then((list) => listener(list));
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(errors: SystemErrorLog[]): void {
    this.listeners.forEach((listener) => {
      try {
        listener(errors);
      } catch {}
    });
  }

  /**
   * Records a system or API error and prunes to strictly keep the last 10 entries.
   */
  public async recordError(params: {
    errorCode: string;
    message: string;
    status?: number;
    source?: string;
    requestId?: string | null;
    details?: any;
  }): Promise<void> {
    try {
      const db = await getDatabase();
      const id = generateUuid();
      const now = new Date().toISOString();
      const detailsJson = params.details
        ? typeof params.details === "string"
          ? params.details
          : JSON.stringify(params.details)
        : null;

      await withTransaction(async (tx) => {
        // Insert new error
        await tx.runAsync(
          `INSERT INTO system_error_logs (
            id, error_code, message, status, source, request_id, details_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            params.errorCode.toUpperCase(),
            params.message,
            params.status ?? 0,
            params.source || null,
            params.requestId || null,
            detailsJson,
            now,
          ]
        );

        // Keep strictly the 10 most recent errors
        await tx.runAsync(
          `DELETE FROM system_error_logs WHERE id NOT IN (
            SELECT id FROM system_error_logs ORDER BY created_at DESC LIMIT ?
          )`,
          [this.maxLogs]
        );
      });

      const updated = await this.getRecentErrors();
      this.notify(updated);
    } catch (e) {
      console.warn("[SystemErrorLogger] Failed to write system error:", e);
    }
  }

  /**
   * Retrieves the 10 most recent system error records.
   */
  public async getRecentErrors(limit = 10): Promise<SystemErrorLog[]> {
    try {
      const db = await getDatabase();
      return await db.getAllAsync<SystemErrorLog>(
        `SELECT * FROM system_error_logs ORDER BY created_at DESC LIMIT ?`,
        [Math.min(limit, this.maxLogs)]
      );
    } catch {
      return [];
    }
  }

  /**
   * Clears all recorded error logs.
   */
  public async clearErrors(): Promise<void> {
    try {
      const db = await getDatabase();
      await db.runAsync(`DELETE FROM system_error_logs`);
      this.notify([]);
    } catch {}
  }
}

export const systemErrorLogger = new SystemErrorLogger();
