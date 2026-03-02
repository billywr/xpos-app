import { apiFetch, buildPageQuery } from "@/api/client";
import type { TaxProfile } from "@/types/catalog";
import type { PageResponse } from "@/types/api";

export async function fetchTaxProfiles(
  token: string | null,
  orgId: string,
  params?: { page?: number; size?: number }
): Promise<PageResponse<TaxProfile>> {
  const query = buildPageQuery({
    page: params?.page ?? 0,
    size: params?.size ?? 200,
    sort: "name,asc",
  });
  return apiFetch<PageResponse<TaxProfile>>(
    `/api/v1/admin/orgs/${orgId}/tax-profiles${query}`,
    { token }
  );
}
