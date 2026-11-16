import { apiFetch } from "./client";
import type {
  CustomerDebtResponse,
  CustomerDebtCreateRequest,
  DebtPendingTotalResponse,
  PageResponse,
} from "@/types";

export async function fetchDebtPendingTotal(
  token: string | null,
  orgId: string,
  branchId: string
): Promise<DebtPendingTotalResponse> {
  return apiFetch<DebtPendingTotalResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/debts/pending-total`,
    { token }
  );
}

export async function fetchDebts(
  token: string | null,
  orgId: string,
  branchId: string,
  params?: {
    page?: number;
    size?: number;
    sort?: string;
    status?: string | readonly string[];
    fromDate?: string;
    toDate?: string;
  }
): Promise<PageResponse<CustomerDebtResponse>> {
  const search = new URLSearchParams();
  if (params?.page !== undefined) search.set("page", String(params.page));
  if (params?.size !== undefined) search.set("size", String(params.size));
  if (params?.sort) search.set("sort", params.sort);
  if (params?.fromDate) search.set("fromDate", params.fromDate);
  if (params?.toDate) search.set("toDate", params.toDate);
  if (params?.status) {
    const list = Array.isArray(params.status) ? params.status : [params.status];
    for (const s of list) {
      if (s) search.append("status", s);
    }
  }
  const qs = search.toString();
  return apiFetch<PageResponse<CustomerDebtResponse>>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/debts${qs ? `?${qs}` : ""}`,
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
    { token, method: "POST", body }
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
    { token, method: "POST", body: { paymentAmount } }
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
