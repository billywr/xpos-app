import { getDatabase, withTransaction } from "@/db/database";
import type {
  CustomerDebtResponse,
  CustomerDebtCreateRequest,
  DebtPendingTotalResponse,
  PageResponse,
} from "@/types";

export async function fetchDebtPendingTotal(
  _token: string | null,
  _orgId: string,
  _branchId: string
): Promise<DebtPendingTotalResponse> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(outstanding) as total FROM customer_debts WHERE status != 'SETTLED' AND status != 'CANCELLED'`
  );
  return { totalPending: Number(row?.total ?? 0) };
}

export async function fetchDebts(
  _token: string | null,
  _orgId: string,
  _branchId: string,
  params?: {
    page?: number;
    size?: number;
    sort?: string;
    status?: string | readonly string[];
    fromDate?: string;
    toDate?: string;
  }
): Promise<PageResponse<CustomerDebtResponse>> {
  const db = await getDatabase();
  const page = params?.page ?? 0;
  const size = params?.size ?? 100;
  const offset = page * size;

  let query = `SELECT * FROM customer_debts WHERE 1=1`;
  const queryParams: any[] = [];

  if (params?.fromDate) {
    query += ` AND date(created_at) >= ?`;
    queryParams.push(params.fromDate);
  }
  if (params?.toDate) {
    query += ` AND date(created_at) <= ?`;
    queryParams.push(params.toDate);
  }
  if (params?.status) {
    const list = Array.isArray(params.status) ? params.status : [params.status];
    if (list.length > 0) {
      const placeholders = list.map(() => "?").join(",");
      query += ` AND status IN (${placeholders})`;
      queryParams.push(...list);
    }
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  queryParams.push(size, offset);

  const rows = await db.getAllAsync<any>(query, queryParams);

  // Get count
  let countQuery = `SELECT COUNT(*) as count FROM customer_debts WHERE 1=1`;
  const countParams: any[] = [];
  if (params?.fromDate) {
    countQuery += ` AND date(created_at) >= ?`;
    countParams.push(params.fromDate);
  }
  if (params?.toDate) {
    countQuery += ` AND date(created_at) <= ?`;
    countParams.push(params.toDate);
  }
  if (params?.status) {
    const list = Array.isArray(params.status) ? params.status : [params.status];
    if (list.length > 0) {
      const placeholders = list.map(() => "?").join(",");
      countQuery += ` AND status IN (${placeholders})`;
      countParams.push(...list);
    }
  }

  const countRow = await db.getFirstAsync<{ count: number }>(countQuery, countParams);
  const totalElements = countRow?.count ?? 0;
  const totalPages = Math.ceil(totalElements / size);

  const content: CustomerDebtResponse[] = rows.map((r) => ({
    id: r.id,
    customerId: "cust-local",
    customerName: r.customer_name,
    customerPhone: r.phone,
    saleId: null,
    amount: Number(r.amount),
    amountSettled: Number(r.settled_amount),
    outstanding: Number(r.outstanding),
    currency: "KES",
    dueDate: null,
    status: r.status,
    notes: r.notes,
    issuedBy: "Operator",
    createdByStaffUserId: "offline-user",
    createdAt: r.created_at,
  }));

  return {
    content,
    totalElements,
    totalPages,
    size,
    number: page,
    first: page === 0,
    last: page >= totalPages - 1,
    empty: content.length === 0,
  };
}

export async function createDebt(
  _token: string | null,
  _orgId: string,
  _branchId: string,
  body: CustomerDebtCreateRequest
): Promise<CustomerDebtResponse> {
  const db = await getDatabase();
  const id = "debt-" + Date.now();
  const now = new Date().toISOString();
  const customerName = body.customerName || "Customer";
  const amount = Number(body.amount);

  await db.runAsync(
    `INSERT INTO customer_debts (
      id, customer_name, phone, amount, settled_amount, outstanding, status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 0.0, ?, 'UNPAID', ?, ?, ?)`,
    [
      id,
      customerName.trim(),
      body.customerPhone?.trim() || null,
      amount,
      amount,
      body.notes?.trim() || null,
      now,
      now,
    ]
  );

  return {
    id,
    customerId: "cust-local",
    customerName,
    customerPhone: body.customerPhone ?? null,
    saleId: null,
    amount,
    amountSettled: 0,
    outstanding: amount,
    currency: "KES",
    dueDate: body.dueDate ?? null,
    status: "UNPAID",
    notes: body.notes ?? null,
    issuedBy: "Operator",
    createdByStaffUserId: "offline-user",
    createdAt: now,
  };
}

export async function settleDebt(
  _token: string | null,
  _orgId: string,
  _branchId: string,
  debtId: string,
  paymentAmount: number
): Promise<CustomerDebtResponse> {
  return await withTransaction(async (db) => {
    const debt = await db.getFirstAsync<any>(
      `SELECT * FROM customer_debts WHERE id = ?`,
      [debtId]
    );

    if (!debt) {
      throw new Error("Debt not found");
    }

    const now = new Date().toISOString();
    const paymentId = "pay-" + Date.now();
    const currentSettled = Number(debt.settled_amount);
    const totalAmount = Number(debt.amount);
    const newSettled = Math.min(totalAmount, currentSettled + Number(paymentAmount));
    const newOutstanding = Math.max(0, totalAmount - newSettled);
    const newStatus = newOutstanding <= 0 ? "SETTLED" : "PARTIAL";

    await db.runAsync(
      `INSERT INTO debt_payments (id, debt_id, amount, payment_method, notes, created_at)
       VALUES (?, ?, ?, 'CASH', 'Payment received', ?)`,
      [paymentId, debtId, paymentAmount, now]
    );

    await db.runAsync(
      `UPDATE customer_debts 
       SET settled_amount = ?, outstanding = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [newSettled, newOutstanding, newStatus, now, debtId]
    );

    return {
      id: debt.id,
      customerId: "cust-local",
      customerName: debt.customer_name,
      customerPhone: debt.phone,
      saleId: null,
      amount: totalAmount,
      amountSettled: newSettled,
      outstanding: newOutstanding,
      currency: "KES",
      dueDate: null,
      status: newStatus,
      notes: debt.notes,
      issuedBy: "Operator",
      createdByStaffUserId: "offline-user",
      createdAt: debt.created_at,
    };
  });
}

export async function cancelDebt(
  _token: string | null,
  _orgId: string,
  _branchId: string,
  debtId: string
): Promise<CustomerDebtResponse> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE customer_debts SET status = 'CANCELLED', outstanding = 0, updated_at = ? WHERE id = ?`,
    [now, debtId]
  );

  const debt = await db.getFirstAsync<any>(
    `SELECT * FROM customer_debts WHERE id = ?`,
    [debtId]
  );

  return {
    id: debt.id,
    customerId: "cust-local",
    customerName: debt.customer_name,
    customerPhone: debt.phone,
    saleId: null,
    amount: Number(debt.amount),
    amountSettled: Number(debt.settled_amount),
    outstanding: 0,
    currency: "KES",
    dueDate: null,
    status: "CANCELLED",
    notes: debt.notes,
    issuedBy: "Operator",
    createdByStaffUserId: "offline-user",
    createdAt: debt.created_at,
  };
}
