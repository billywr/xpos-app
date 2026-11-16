import { getDatabase } from "@/db/database";
import type {
  MiscExpenseResponse,
  MiscExpenseCreateRequest,
  MiscExpenseListResponse,
} from "@/types";

export async function fetchMiscExpenses(
  _token: string | null,
  _orgId: string,
  _branchId: string,
  params?: { page?: number; size?: number; sort?: string; fromDate?: string; toDate?: string }
): Promise<MiscExpenseListResponse> {
  const db = await getDatabase();
  const page = params?.page ?? 0;
  const size = params?.size ?? 100;
  const offset = page * size;

  let query = `SELECT * FROM misc_expenses WHERE 1=1`;
  const queryParams: any[] = [];

  if (params?.fromDate) {
    query += ` AND date(created_at) >= ?`;
    queryParams.push(params.fromDate);
  }
  if (params?.toDate) {
    query += ` AND date(created_at) <= ?`;
    queryParams.push(params.toDate);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  queryParams.push(size, offset);

  const rows = await db.getAllAsync<any>(query, queryParams);

  // Get total sum
  let sumQuery = `SELECT SUM(amount) as total, COUNT(*) as count FROM misc_expenses WHERE 1=1`;
  const sumParams: any[] = [];
  if (params?.fromDate) {
    sumQuery += ` AND date(created_at) >= ?`;
    sumParams.push(params.fromDate);
  }
  if (params?.toDate) {
    sumQuery += ` AND date(created_at) <= ?`;
    sumParams.push(params.toDate);
  }
  const sumResult = await db.getFirstAsync<{ total: number | null; count: number }>(
    sumQuery,
    sumParams
  );

  const totalElements = sumResult?.count ?? 0;
  const totalPages = Math.ceil(totalElements / size);

  const content: MiscExpenseResponse[] = rows.map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    category: r.category,
    description: r.description,
    incurredBy: r.incurred_by,
    receiptRef: r.receipt_ref,
    terminalId: "offline-terminal",
    shiftId: null,
    createdByStaffUserId: "offline-user",
    createdAt: r.created_at,
  }));

  return {
    content,
    totalElements,
    totalPages,
    size,
    number: page,
    totalAmount: Number(sumResult?.total ?? 0),
  };
}

export async function createMiscExpense(
  _token: string | null,
  _orgId: string,
  _branchId: string,
  body: MiscExpenseCreateRequest
): Promise<MiscExpenseResponse> {
  const db = await getDatabase();
  const id = "exp-" + Date.now();
  const now = new Date().toISOString();
  const amount = Number(body.amount);

  await db.runAsync(
    `INSERT INTO misc_expenses (id, amount, category, description, incurred_by, receipt_ref, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      amount,
      body.category.trim(),
      body.description.trim(),
      body.incurredBy?.trim() || null,
      body.receiptRef?.trim() || null,
      now,
    ]
  );

  return {
    id,
    amount,
    category: body.category,
    description: body.description,
    incurredBy: body.incurredBy ?? null,
    receiptRef: body.receiptRef ?? null,
    terminalId: "offline-terminal",
    shiftId: null,
    createdByStaffUserId: "offline-user",
    createdAt: now,
  };
}

export async function fetchExpenseCategories(
  _token: string | null,
  _orgId: string,
  _branchId: string
): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ category: string }>(
    `SELECT DISTINCT category FROM misc_expenses ORDER BY category ASC`
  );

  const defaults = ["Supplies", "Utilities", "Transport", "Repairs", "Meals", "General"];
  const set = new Set([...defaults, ...rows.map((r) => r.category)]);
  return Array.from(set);
}

export async function cancelMiscExpense(
  _token: string | null,
  _orgId: string,
  _branchId: string,
  expenseId: string
): Promise<MiscExpenseResponse> {
  const db = await getDatabase();
  const exp = await db.getFirstAsync<any>(`SELECT * FROM misc_expenses WHERE id = ?`, [expenseId]);
  await db.runAsync(`DELETE FROM misc_expenses WHERE id = ?`, [expenseId]);

  return {
    id: expenseId,
    amount: Number(exp?.amount ?? 0),
    category: exp?.category ?? "General",
    description: exp?.description ?? "",
    incurredBy: exp?.incurred_by ?? null,
    receiptRef: exp?.receipt_ref ?? null,
    terminalId: "offline-terminal",
    shiftId: null,
    createdByStaffUserId: "offline-user",
    createdAt: exp?.created_at ?? new Date().toISOString(),
  };
}
