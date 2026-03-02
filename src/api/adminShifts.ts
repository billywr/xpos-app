import { apiFetch, buildPageQuery } from "@/api/client";
import type { Shift } from "@/types/shift";
import type { PageResponse } from "@/types/api";

/**
 * Admin: list shifts for a branch.
 */
export async function fetchShifts(
  token: string | null,
  orgId: string,
  branchId: string,
  params?: { page?: number; size?: number }
): Promise<PageResponse<Shift>> {
  const query = buildPageQuery({
    page: params?.page ?? 0,
    size: params?.size ?? 25,
  });
  return apiFetch<PageResponse<Shift>>(
    `/api/v1/admin/orgs/${orgId}/branches/${branchId}/shifts${query}`,
    { token }
  );
}
