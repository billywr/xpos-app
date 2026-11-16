import { getDatabase, withTransaction } from "@/db/sqlite";
import { generateUuid } from "@/utils/uuid";
import { outboxEngine } from "@/services/outboxEngine";
import type {
  CustomerDebtResponse,
  CustomerDebtCreateRequest,
  MiscExpenseResponse,
  MiscExpenseCreateRequest,
} from "@/types";

export class DebtsExpensesRepository {
  /**
   * Records a customer debt locally in SQLite and enqueues an outbox mutation for background sync.
   */
  public async createDebt(
    orgId: string,
    branchId: string,
    request: CustomerDebtCreateRequest
  ): Promise<CustomerDebtResponse> {
    const debtId = generateUuid();
    const now = new Date().toISOString();
    const customerName = request.customerName || "Customer";
    const outstanding = request.amount;

    await withTransaction(async (db) => {
      await db.runAsync(
        `INSERT INTO customer_debts (
           id, org_id, branch_id, customer_name, phone, amount,
           settled_amount, outstanding, status, notes, created_at, updated_at, sync_status
         ) VALUES (?, ?, ?, ?, ?, ?, 0.0, ?, 'UNPAID', ?, ?, ?, 'PENDING')`,
        [
          debtId,
          orgId,
          branchId,
          customerName,
          request.customerPhone ?? null,
          request.amount,
          outstanding,
          request.notes ?? null,
          now,
          now,
        ]
      );

      await outboxEngine.enqueue(
        {
          orgId,
          branchId,
          entityType: "DEBT_CREATE",
          entityId: debtId,
          action: "CREATE",
          endpoint: `/api/v1/operator/orgs/${orgId}/branches/${branchId}/debts`,
          httpMethod: "POST",
          payloadJson: JSON.stringify(request),
        },
        db
      );
    });

    return {
      id: debtId,
      customerId: request.customerId || debtId,
      customerName,
      customerPhone: request.customerPhone ?? null,
      saleId: null,
      amount: request.amount,
      amountSettled: 0,
      outstanding,
      currency: "KES",
      status: "UNPAID",
      notes: request.notes ?? null,
      dueDate: request.dueDate ?? null,
      issuedBy: request.issuedBy ?? null,
      createdByStaffUserId: "",
      createdAt: now,
    };
  }

  /**
   * Settles debt payment locally in SQLite and enqueues an outbox mutation for background sync.
   */
  public async settleDebt(
    orgId: string,
    branchId: string,
    debtId: string,
    paymentAmount: number
  ): Promise<void> {
    const now = new Date().toISOString();
    const paymentId = generateUuid();

    await withTransaction(async (db) => {
      const debt = await db.getFirstAsync<any>(
        `SELECT * FROM customer_debts WHERE id = ?`,
        [debtId]
      );

      if (debt) {
        const newSettled = Math.round(((debt.settled_amount || 0) + paymentAmount) * 100) / 100;
        const newOutstanding = Math.max(0, Math.round(((debt.amount || 0) - newSettled) * 100) / 100);
        const newStatus = newOutstanding <= 0 ? "PAID" : "PARTIAL";

        await db.runAsync(
          `UPDATE customer_debts SET
             settled_amount = ?,
             outstanding = ?,
             status = ?,
             updated_at = ?
           WHERE id = ?`,
          [newSettled, newOutstanding, newStatus, now, debtId]
        );
      }

      await db.runAsync(
        `INSERT INTO debt_payments (id, debt_id, amount, payment_method, notes, created_at, sync_status)
         VALUES (?, ?, ?, 'CASH', 'Payment', ?, 'PENDING')`,
        [paymentId, debtId, paymentAmount, now]
      );

      await outboxEngine.enqueue(
        {
          orgId,
          branchId,
          entityType: "DEBT_SETTLE",
          entityId: debtId,
          action: "SETTLE",
          endpoint: `/api/v1/operator/orgs/${orgId}/branches/${branchId}/debts/${debtId}/settle`,
          httpMethod: "POST",
          payloadJson: JSON.stringify({ paymentAmount }),
        },
        db
      );
    });
  }

  /**
   * Records a miscellaneous expense locally in SQLite and enqueues an outbox mutation for background sync.
   */
  public async createExpense(
    orgId: string,
    branchId: string,
    request: MiscExpenseCreateRequest
  ): Promise<MiscExpenseResponse> {
    const expenseId = generateUuid();
    const now = new Date().toISOString();

    await withTransaction(async (db) => {
      await db.runAsync(
        `INSERT INTO misc_expenses (
           id, org_id, branch_id, amount, category, description, incurred_by, receipt_ref, created_at, sync_status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [
          expenseId,
          orgId,
          branchId,
          request.amount,
          request.category,
          request.description,
          request.incurredBy ?? null,
          request.receiptRef ?? null,
          now,
        ]
      );

      await outboxEngine.enqueue(
        {
          orgId,
          branchId,
          entityType: "EXPENSE_CREATE",
          entityId: expenseId,
          action: "CREATE",
          endpoint: `/api/v1/operator/orgs/${orgId}/branches/${branchId}/misc-expenses`,
          httpMethod: "POST",
          payloadJson: JSON.stringify(request),
        },
        db
      );
    });

    return {
      id: expenseId,
      amount: request.amount,
      category: request.category,
      description: request.description,
      incurredBy: request.incurredBy ?? null,
      receiptRef: request.receiptRef ?? null,
      terminalId: null,
      shiftId: null,
      createdByStaffUserId: "",
      createdAt: now,
    };
  }

  /**
   * Retrieves customer debts from local SQLite (<5ms).
   */
  public async getDebts(
    orgId: string,
    branchId: string,
    statusFilter?: string
  ): Promise<CustomerDebtResponse[]> {
    const db = await getDatabase();
    let query = `SELECT * FROM customer_debts WHERE org_id = ? AND branch_id = ?`;
    const params: any[] = [orgId, branchId];
    if (statusFilter && statusFilter !== "ALL") {
      if (statusFilter === "OUTSTANDING") {
        query += ` AND status IN ('OPEN', 'PARTIAL', 'UNPAID')`;
      } else {
        query += ` AND status = ?`;
        params.push(statusFilter);
      }
    }
    query += ` ORDER BY created_at DESC`;
    const rows = await db.getAllAsync<any>(query, params);
    return rows.map((r) => ({
      id: r.id,
      customerId: r.id,
      customerName: r.customer_name,
      customerPhone: r.phone,
      saleId: null,
      amount: r.amount,
      amountSettled: r.settled_amount || 0,
      outstanding: r.outstanding,
      currency: "KES",
      status: r.status,
      notes: r.notes,
      dueDate: null,
      issuedBy: null,
      createdByStaffUserId: "",
      createdAt: r.created_at,
    }));
  }

  /**
   * Retrieves miscellaneous expenses from local SQLite (<5ms).
   */
  public async getExpenses(
    orgId: string,
    branchId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<MiscExpenseResponse[]> {
    const db = await getDatabase();
    let query = `SELECT * FROM misc_expenses WHERE org_id = ? AND branch_id = ?`;
    const params: any[] = [orgId, branchId];
    if (fromDate) {
      query += ` AND created_at >= ?`;
      params.push(fromDate);
    }
    if (toDate) {
      query += ` AND created_at <= ?`;
      params.push(toDate + "T23:59:59.999Z");
    }
    query += ` ORDER BY created_at DESC`;
    const rows = await db.getAllAsync<any>(query, params);
    return rows.map((r) => ({
      id: r.id,
      amount: r.amount,
      category: r.category,
      description: r.description,
      incurredBy: r.incurred_by,
      receiptRef: r.receipt_ref,
      terminalId: null,
      shiftId: null,
      createdByStaffUserId: "",
      createdAt: r.created_at,
    }));
  }

  /**
   * Hydrates remote debts into local SQLite without clobbering pending local drafts.
   */
  public async hydrateDebtsFromRemote(
    orgId: string,
    branchId: string,
    remoteDebts: CustomerDebtResponse[]
  ): Promise<void> {
    if (!remoteDebts || remoteDebts.length === 0) return;
    await withTransaction(async (db) => {
      for (const d of remoteDebts) {
        const dt = d.createdAt || new Date().toISOString();
        await db.runAsync(
          `INSERT INTO customer_debts (
             id, org_id, branch_id, customer_name, phone, amount,
             settled_amount, outstanding, status, notes, created_at, updated_at, sync_status
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMMITTED')
           ON CONFLICT(id) DO UPDATE SET
             customer_name = excluded.customer_name,
             phone = excluded.phone,
             amount = excluded.amount,
             settled_amount = excluded.settled_amount,
             outstanding = excluded.outstanding,
             status = excluded.status,
             notes = excluded.notes,
             updated_at = excluded.updated_at
           WHERE sync_status != 'PENDING'`,
          [
            d.id,
            orgId,
            branchId,
            d.customerName || "Customer",
            d.customerPhone || null,
            d.amount,
            d.amountSettled || 0,
            d.outstanding,
            d.status,
            d.notes || null,
            dt,
            dt,
          ]
        );
      }
    });
  }

  /**
   * Hydrates remote expenses into local SQLite without clobbering pending local drafts.
   */
  public async hydrateExpensesFromRemote(
    orgId: string,
    branchId: string,
    remoteExpenses: MiscExpenseResponse[]
  ): Promise<void> {
    if (!remoteExpenses || remoteExpenses.length === 0) return;
    await withTransaction(async (db) => {
      for (const e of remoteExpenses) {
        const dt = e.createdAt || new Date().toISOString();
        await db.runAsync(
          `INSERT INTO misc_expenses (
             id, org_id, branch_id, amount, category, description, incurred_by, receipt_ref, created_at, sync_status
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMMITTED')
           ON CONFLICT(id) DO UPDATE SET
             amount = excluded.amount,
             category = excluded.category,
             description = excluded.description,
             incurred_by = excluded.incurred_by,
             receipt_ref = excluded.receipt_ref
           WHERE sync_status != 'PENDING'`,
          [
            e.id,
            orgId,
            branchId,
            e.amount,
            e.category,
            e.description,
            e.incurredBy || null,
            e.receiptRef || null,
            dt,
          ]
        );
      }
    });
  }
}

export const debtsExpensesRepository = new DebtsExpensesRepository();

