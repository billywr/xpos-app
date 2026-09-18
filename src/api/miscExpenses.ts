import { apiFetch } from "./client";
import type {
  MiscExpenseResponse,
  MiscExpenseCreateRequest,
  MiscExpenseListResponse,
} from "@/types";

export async function fetchMiscExpenses(
  token: string | null,
  orgId: string,
  branchId: string,
  params?: { page?: number; size?: number; sort?: string; fromDate?: string; toDate?: string }
): Promise<MiscExpenseListResponse> {
  const search = new URLSearchParams();
  if (params?.page !== undefined) search.set("page", String(params.page));
  if (params?.size !== undefined) search.set("size", String(params.size));
  if (params?.sort) search.set("sort", params.sort);
  if (params?.fromDate) search.set("fromDate", params.fromDate);
  if (params?.toDate) search.set("toDate", params.toDate);
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
    { token, method: "POST", body }
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
