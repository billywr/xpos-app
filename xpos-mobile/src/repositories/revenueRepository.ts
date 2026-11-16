import { getDatabase } from "@/db/sqlite";
import {
  fetchRevenueDashboard,
  type RevenueDashboardResponse,
} from "@/api/revenueDashboard";

export class RevenueRepository {
  private getCacheKey(orgId: string, branchId: string, startDate: string, endDate: string): string {
    return `rev_dash_${orgId}_${branchId}_${startDate}_${endDate}`;
  }

  /**
   * Retrieves cached revenue dashboard from local SQLite (<1ms).
   */
  public async getCachedDashboard(
    orgId: string,
    branchId: string,
    startDate: string,
    endDate: string
  ): Promise<RevenueDashboardResponse | null> {
    try {
      const db = await getDatabase();
      const key = this.getCacheKey(orgId, branchId, startDate, endDate);
      const row = await db.getFirstAsync<{ json_data: string }>(
        `SELECT json_data FROM dashboard_cache WHERE key = ?`,
        [key]
      );
      if (row?.json_data) {
        return JSON.parse(row.json_data) as RevenueDashboardResponse;
      }
    } catch (err) {
      console.warn("[RevenueRepository] Error reading dashboard cache:", err);
    }
    return null;
  }

  /**
   * Saves revenue dashboard to local SQLite cache.
   */
  public async saveCachedDashboard(
    orgId: string,
    branchId: string,
    startDate: string,
    endDate: string,
    data: RevenueDashboardResponse
  ): Promise<void> {
    try {
      const db = await getDatabase();
      const key = this.getCacheKey(orgId, branchId, startDate, endDate);
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO dashboard_cache (key, json_data, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           json_data = excluded.json_data,
           updated_at = excluded.updated_at`,
        [key, JSON.stringify(data), now]
      );
    } catch (err) {
      console.warn("[RevenueRepository] Error saving dashboard cache:", err);
    }
  }

  /**
   * Fetches latest revenue dashboard from remote and updates local SQLite cache.
   */
  public async hydrateDashboard(
    token: string,
    orgId: string,
    branchId: string,
    startDate: string,
    endDate: string
  ): Promise<RevenueDashboardResponse | null> {
    try {
      const res = await fetchRevenueDashboard(token, orgId, branchId, startDate, endDate);
      if (res) {
        await this.saveCachedDashboard(orgId, branchId, startDate, endDate, res);
      }
      return res;
    } catch (err) {
      console.warn("[RevenueRepository] Remote revenue fetch failed (offline or network error):", err);
      return null;
    }
  }
}

export const revenueRepository = new RevenueRepository();
