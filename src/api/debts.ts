import { apiFetch } from "@/api/client";
import type { PageResponse } from "@/types/api";

export interface CustomerDebtResponse {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  saleId: string | null;
  amount: number;
  amountSettled: number;
  outstanding: number;
  currency: string;
  dueDate: string | null;
  status: string;
  notes: string | null;
  createdByStaffUserId: string;
  createdAt: string;
}

export interface CustomerDebtCreateRequest {
  customerId: string;
  amount: number;
  dueDate?: string;
  notes?: string;
}

export interface CustomerDebtUpdateRequest {
  amount?: number;
  outstanding?: number;
  dueDate?: string;
  notes?: string;
}

export async function fetchDebts(
  token: string | null,
  orgId: string,
  branchId: string,
  params?: { page?: number; size?: number; sort?: string; status?: string }
): Promise<PageResponse<CustomerDebtResponse>> {
  const search = new URLSearchParams();
  const p = params ?? {};
  if (p.page !== undefined) search.set("page", String(p.page));
  if (p.size !== undefined) search.set("size", String(p.size));
  if (p.sort) search.set("sort", p.sort);
  if (p.status) search.set("status", p.status);
  const query = search.toString();
  return apiFetch<PageResponse<CustomerDebtResponse>>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/debts${query ? `?${query}` : ""}`,
    { token }
  );
}

export async function createDebt(
  token: string | null,
  orgId: string,
  branchId: string,
  body: CustomerDebtCreateRequest
): Promise<CustomerDebtResponse> {
  return apiFetch<CustomerDebtResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/debts`,
    { token, body, method: "POST" }
  );
}

export async function updateDebt(
  token: string | null,
  orgId: string,
  branchId: string,
  debtId: string,
  body: CustomerDebtUpdateRequest
): Promise<CustomerDebtResponse> {
  return apiFetch<CustomerDebtResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/debts/${debtId}`,
    { token, body, method: "PATCH" }
  );
}

export async function settleDebt(
  token: string | null,
  orgId: string,
  branchId: string,
  debtId: string,
  paymentAmount: number
): Promise<CustomerDebtResponse> {
  return apiFetch<CustomerDebtResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/debts/${debtId}/settle`,
    { token, body: { paymentAmount }, method: "POST" }
  );
}

export async function cancelDebt(
  token: string | null,
  orgId: string,
  branchId: string,
  debtId: string
): Promise<CustomerDebtResponse> {
  return apiFetch<CustomerDebtResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/debts/${debtId}/cancel`,
    { token, method: "POST" }
  );
}
