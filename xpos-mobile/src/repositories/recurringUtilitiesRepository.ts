import { getDatabase, withTransaction } from "@/db/sqlite";
import { generateUuid } from "@/utils/uuid";
import { outboxEngine } from "@/services/outboxEngine";
import type {
  RecurringUtilityResponse,
  RecurringUtilityCreateRequest,
  RecurringUtilityUpdateRequest,
  RecurringUtilitySummaryResponse,
} from "@/types";

export class RecurringUtilitiesRepository {
  /**
   * Retrieves recurring utilities from local SQLite (<5ms).
   */
  public async getUtilities(
    orgId: string,
    branchId: string,
    activeFilter?: boolean | "ALL"
  ): Promise<RecurringUtilityResponse[]> {
    const db = await getDatabase();
    let query = `SELECT * FROM recurring_utilities WHERE org_id = ? AND branch_id = ?`;
    const params: any[] = [orgId, branchId];

    if (activeFilter !== undefined && activeFilter !== "ALL") {
      query += ` AND active = ?`;
      params.push(activeFilter ? 1 : 0);
    }

    query += ` ORDER BY name COLLATE NOCASE ASC`;
    const rows = await db.getAllAsync<any>(query, params);

    return rows.map((r) => ({
      id: r.id,
      orgId: r.org_id,
      branchId: r.branch_id,
      name: r.name,
      amount: Number(r.amount),
      applyTiming: r.apply_timing || "BEGINNING_OF_MONTH",
      notes: r.notes ?? null,
      active: Boolean(r.active),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      syncStatus: r.sync_status,
    }));
  }

  /**
   * Computes utility summary (active count and monthly total) from local SQLite (<5ms).
   */
  public async getUtilitySummary(
    orgId: string,
    branchId: string
  ): Promise<RecurringUtilitySummaryResponse> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ cnt: number; total: number }>(
      `SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total 
       FROM recurring_utilities 
       WHERE org_id = ? AND branch_id = ? AND active = 1`,
      [orgId, branchId]
    );

    return {
      activeCount: row?.cnt || 0,
      monthlyTotalAmount: Number(row?.total || 0),
    };
  }

  /**
   * Records a recurring utility locally in SQLite and enqueues an outbox mutation for background sync.
   */
  public async createUtility(
    orgId: string,
    branchId: string,
    request: RecurringUtilityCreateRequest
  ): Promise<RecurringUtilityResponse> {
    const utilityId = generateUuid();
    const now = new Date().toISOString();
    const applyTiming = request.applyTiming || "BEGINNING_OF_MONTH";
    const notes = request.notes?.trim() || null;

    await withTransaction(async (db) => {
      await db.runAsync(
        `INSERT INTO recurring_utilities (
           id, org_id, branch_id, name, amount, apply_timing, notes, active, created_at, updated_at, sync_status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'PENDING')`,
        [
          utilityId,
          orgId,
          branchId,
          request.name.trim(),
          request.amount,
          applyTiming,
          notes,
          now,
          now,
        ]
      );

      await outboxEngine.enqueue(
        {
          orgId,
          branchId,
          entityType: "UTILITY_CREATE",
          entityId: utilityId,
          action: "CREATE",
          endpoint: `/api/v1/operator/orgs/${orgId}/branches/${branchId}/recurring-utilities`,
          httpMethod: "POST",
          payloadJson: JSON.stringify(request),
        },
        db
      );
    });

    return {
      id: utilityId,
      orgId,
      branchId,
      name: request.name.trim(),
      amount: request.amount,
      applyTiming,
      notes,
      active: true,
      createdAt: now,
      updatedAt: now,
      syncStatus: "PENDING",
    };
  }

  /**
   * Updates a recurring utility locally in SQLite and enqueues an outbox mutation for background sync.
   */
  public async updateUtility(
    orgId: string,
    branchId: string,
    utilityId: string,
    request: RecurringUtilityUpdateRequest
  ): Promise<RecurringUtilityResponse> {
    const now = new Date().toISOString();

    let updatedRecord: RecurringUtilityResponse | null = null;

    await withTransaction(async (db) => {
      const existing = await db.getFirstAsync<any>(
        `SELECT * FROM recurring_utilities WHERE id = ? AND org_id = ? AND branch_id = ?`,
        [utilityId, orgId, branchId]
      );

      if (!existing) {
        throw new Error("Utility not found");
      }

      const newName = request.name !== undefined ? request.name.trim() : existing.name;
      const newAmount = request.amount !== undefined ? request.amount : Number(existing.amount);
      const newTiming = request.applyTiming !== undefined ? request.applyTiming : existing.apply_timing;
      const newActive = request.active !== undefined ? (request.active ? 1 : 0) : existing.active;
      const newNotes = request.notes !== undefined ? (request.notes?.trim() || null) : existing.notes;

      await db.runAsync(
        `UPDATE recurring_utilities SET
           name = ?,
           amount = ?,
           apply_timing = ?,
           active = ?,
           notes = ?,
           updated_at = ?,
           sync_status = 'PENDING'
         WHERE id = ?`,
        [newName, newAmount, newTiming, newActive, newNotes, now, utilityId]
      );

      await outboxEngine.enqueue(
        {
          orgId,
          branchId,
          entityType: "UTILITY_UPDATE",
          entityId: utilityId,
          action: "UPDATE",
          endpoint: `/api/v1/operator/orgs/${orgId}/branches/${branchId}/recurring-utilities/${utilityId}`,
          httpMethod: "PUT",
          payloadJson: JSON.stringify(request),
        },
        db
      );

      updatedRecord = {
        id: utilityId,
        orgId,
        branchId,
        name: newName,
        amount: newAmount,
        applyTiming: newTiming,
        active: Boolean(newActive),
        notes: newNotes,
        createdAt: existing.created_at,
        updatedAt: now,
        syncStatus: "PENDING",
      };
    });

    return updatedRecord!;
  }

  /**
   * Deletes a recurring utility locally in SQLite and enqueues an outbox mutation for background sync.
   */
  public async deleteUtility(
    orgId: string,
    branchId: string,
    utilityId: string
  ): Promise<void> {
    await withTransaction(async (db) => {
      await db.runAsync(
        `DELETE FROM recurring_utilities WHERE id = ? AND org_id = ? AND branch_id = ?`,
        [utilityId, orgId, branchId]
      );

      await outboxEngine.enqueue(
        {
          orgId,
          branchId,
          entityType: "UTILITY_DELETE",
          entityId: utilityId,
          action: "DELETE",
          endpoint: `/api/v1/operator/orgs/${orgId}/branches/${branchId}/recurring-utilities/${utilityId}`,
          httpMethod: "DELETE",
          payloadJson: JSON.stringify({}),
        },
        db
      );
    });
  }

  /**
   * Hydrates remote recurring utilities into local SQLite without clobbering pending local drafts.
   */
  public async hydrateFromRemote(
    orgId: string,
    branchId: string,
    remoteUtilities: RecurringUtilityResponse[]
  ): Promise<void> {
    if (!remoteUtilities || remoteUtilities.length === 0) return;
    await withTransaction(async (db) => {
      for (const u of remoteUtilities) {
        const createdAt = u.createdAt || new Date().toISOString();
        const updatedAt = u.updatedAt || createdAt;
        await db.runAsync(
          `INSERT INTO recurring_utilities (
             id, org_id, branch_id, name, amount, apply_timing, notes, active, created_at, updated_at, sync_status
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMMITTED')
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             amount = excluded.amount,
             apply_timing = excluded.apply_timing,
             notes = excluded.notes,
             active = excluded.active,
             updated_at = excluded.updated_at
           WHERE sync_status != 'PENDING'`,
          [
            u.id,
            orgId,
            branchId,
            u.name,
            u.amount,
            u.applyTiming || "BEGINNING_OF_MONTH",
            u.notes ?? null,
            u.active ? 1 : 0,
            createdAt,
            updatedAt,
          ]
        );
      }
    });
  }
}

export const recurringUtilitiesRepository = new RecurringUtilitiesRepository();
