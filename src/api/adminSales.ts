import { apiFetch } from "@/api/client";
import type { PageResponse } from "@/types/api";

export interface SaleSummary {
  id: string;
  orgId: string;
  branchId: string;
  terminalId: string;
  receiptNumber: number | null;
  status: string;
  total: number;
  createdByStaffUserId: string;
  createdByUsername: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface FetchAdminSalesParams {
  page?: number;
  size?: number;
  status?: string;
  fromDate?: string; // YYYY-MM-DD
  toDate?: string; // YYYY-MM-DD
}

/**
 * Admin: list completed sales for a branch.
 */
export async function fetchAdminSales(
  token: string | null,
  orgId: string,
  branchId: string,
  params?: FetchAdminSalesParams
): Promise<PageResponse<SaleSummary>> {
  const query = new URLSearchParams();
  if (params?.page != null) query.set("page", String(params.page));
  if (params?.size != null) query.set("size", String(params.size));
  if (params?.status) query.set("status", params.status);
  if (params?.fromDate) query.set("fromDate", params.fromDate);
  if (params?.toDate) query.set("toDate", params.toDate);
  const qs = query.toString();
  const path = `/api/v1/admin/orgs/${orgId}/branches/${branchId}/sales${qs ? `?${qs}` : ""}`;
  return apiFetch<PageResponse<SaleSummary>>(path, { token });
}
