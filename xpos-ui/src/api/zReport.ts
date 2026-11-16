import { apiFetch } from "@/api/client";
import type { ZReportSummary } from "@/types/cash";

/**
 * Admin: get Z-report for branch and business date. businessDate as YYYY-MM-DD.
 */
export async function fetchZReport(
  token: string | null,
  orgId: string,
  branchId: string,
  businessDate: string
): Promise<ZReportSummary> {
  return apiFetch<ZReportSummary>(
    `/api/v1/admin/orgs/${orgId}/branches/${branchId}/z-report?businessDate=${encodeURIComponent(businessDate)}`,
    { token }
  );
}
