import { apiFetch } from "@/api/client";

export interface RevenueSummaryResponse {
  orgId: string;
  branchId: string;
  startDate: string;
  endDate: string;
  revenueTotal: number;
  taxTotal: number;
  discountTotal: number;
  cogsTotal: number;
  saleCount: number;
}

export interface RevenueTrendPointResponse {
  date: string;
  revenue: number;
  tax: number;
  cogs: number;
  saleCount: number;
}

export interface RevenueDashboardResponse {
  summary: RevenueSummaryResponse;
  trend: RevenueTrendPointResponse[];
}

export async function fetchRevenueDashboard(
  token: string | null,
  orgId: string,
  branchId: string,
  startDate: string,
  endDate: string
): Promise<RevenueDashboardResponse> {
  const params = new URLSearchParams({
    startDate,
    endDate,
  });
  return apiFetch<RevenueDashboardResponse>(
    `/api/v1/admin/orgs/${orgId}/branches/${branchId}/revenue-dashboard?${params}`,
    { token }
  );
}
