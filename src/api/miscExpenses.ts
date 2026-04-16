import { apiFetch } from "@/api/client";

export interface MiscExpenseResponse {
  id: string;
  amount: number;
  category: string;
  description: string;
  incurredBy: string | null;
  receiptRef: string | null;
  terminalId: string | null;
  shiftId: string | null;
  createdByStaffUserId: string;
  createdAt: string;
}

export interface MiscExpenseCreateRequest {
  amount: number;
  category: string;
  description: string;
  incurredBy?: string;
  receiptRef?: string;
}

export interface MiscExpenseUpdateRequest {
  amount: number;
  category: string;
  description: string;
  incurredBy?: string;
  receiptRef?: string;
}

export interface MiscExpenseListResponse {
  content: MiscExpenseResponse[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  totalAmount: number;
}

export async function fetchMiscExpenses(
  token: string | null,
  orgId: string,
  branchId: string,
  params?: { page?: number; size?: number; sort?: string; fromDate?: string; toDate?: string }
): Promise<MiscExpenseListResponse> {
  const search = new URLSearchParams();
  const p = params ?? {};
  if (p.page !== undefined) search.set("page", String(p.page));
  if (p.size !== undefined) search.set("size", String(p.size));
  if (p.sort) search.set("sort", p.sort);
  if (p.fromDate) search.set("fromDate", p.fromDate);
  if (p.toDate) search.set("toDate", p.toDate);
  const qs = search.toString();
  return apiFetch<MiscExpenseListResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/misc-expenses${qs ? `?${qs}` : ""}`,
    { token }
  );
}

export async function createMiscExpense(
  token: string | null,
  orgId: string,
  branchId: string,
  body: MiscExpenseCreateRequest
): Promise<MiscExpenseResponse> {
  return apiFetch<MiscExpenseResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/misc-expenses`,
    { token, body, method: "POST" }
  );
}

export async function updateMiscExpense(
  token: string | null,
  orgId: string,
  branchId: string,
  expenseId: string,
  body: MiscExpenseUpdateRequest
): Promise<MiscExpenseResponse> {
  return apiFetch<MiscExpenseResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/misc-expenses/${expenseId}`,
    { token, body, method: "PATCH" }
  );
}

export async function fetchExpenseCategories(
  token: string | null,
  orgId: string,
  branchId: string
): Promise<string[]> {
  return apiFetch<string[]>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/misc-expenses/categories`,
    { token }
  );
}

export async function cancelMiscExpense(
  token: string | null,
  orgId: string,
  branchId: string,
  expenseId: string
): Promise<MiscExpenseResponse> {
  return apiFetch<MiscExpenseResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/misc-expenses/${expenseId}/cancel`,
    { token, method: "POST" }
  );
}
