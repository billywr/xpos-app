import { apiFetch } from "@/api/client";

/**
 * Operator: close day for branch. businessDate as YYYY-MM-DD.
 */
export async function postDayClose(
  token: string | null,
  orgId: string,
  branchId: string,
  businessDate: string
): Promise<{ id: string; orgId: string; branchId: string; businessDate: string; status: string }> {
  return apiFetch(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/day-close`,
    {
      token,
      method: "POST",
      body: { businessDate },
    }
  );
}
