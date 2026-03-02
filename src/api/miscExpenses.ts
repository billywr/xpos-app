import { apiFetch, buildPageQuery } from "@/api/client";

export type MiscExpenseCategory =
  | "UTILITIES"
  | "SUPPLIES"
  | "MAINTENANCE"
  | "TRANSPORT"
  | "FUEL"
  | "RENT"
  | "SALARIES"
  | "OTHER";

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
  category: MiscExpenseCategory;
  description: string;
  incurredBy?: string;
  receiptRef?: string;
}

export interface MiscExpenseUpdateRequest {
  amount: number;
  category: MiscExpenseCategory;
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
  params?: { page?: number; size?: number; sort?: string }
): Promise<MiscExpenseListResponse> {
  const query = buildPageQuery(params ?? {});
  return apiFetch<MiscExpenseListResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/misc-expenses${query}`,
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
