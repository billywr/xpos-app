import { apiFetch, buildPageQuery } from "@/api/client";
import type { Uom } from "@/types/catalog";
import type { PageResponse } from "@/types/api";

export async function fetchUoms(
  token: string | null,
  orgId: string,
  params?: { page?: number; size?: number }
): Promise<PageResponse<Uom>> {
  const query = buildPageQuery({
    page: params?.page ?? 0,
    size: params?.size ?? 200,
    sort: "name,asc",
  });
  return apiFetch<PageResponse<Uom>>(
    `/api/v1/admin/orgs/${orgId}/uoms${query}`,
    { token }
  );
}

export async function createUom(
  token: string | null,
  orgId: string,
  body: { name: string; symbol: string | null }
): Promise<Uom> {
  return apiFetch<Uom>(`/api/v1/admin/orgs/${orgId}/uoms`, {
    token,
    method: "POST",
    body: { name: body.name.trim(), symbol: body.symbol?.trim() || null },
  });
}

export async function updateUom(
  token: string | null,
  orgId: string,
  uomId: string,
  body: { name: string; symbol: string | null }
): Promise<Uom> {
  return apiFetch<Uom>(`/api/v1/admin/orgs/${orgId}/uoms/${uomId}`, {
    token,
    method: "PATCH",
    body: { name: body.name.trim(), symbol: body.symbol?.trim() || null },
  });
}

export async function deleteUom(
  token: string | null,
  orgId: string,
  uomId: string
): Promise<void> {
  await apiFetch<void>(`/api/v1/admin/orgs/${orgId}/uoms/${uomId}`, {
    token,
    method: "DELETE",
  });
}
