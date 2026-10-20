import { apiFetch, buildPageQuery } from "@/api/client";
import type { PageResponse } from "@/types/api";
import type { TableArea } from "@/types/sales";

export async function fetchTableAreas(
  token: string | null,
  orgId: string,
  branchId: string,
  params?: { page?: number; size?: number; sort?: string }
): Promise<PageResponse<TableArea>> {
  const query = buildPageQuery({
    page: params?.page ?? 0,
    size: params?.size ?? 100,
    sort: params?.sort ?? "createdAt,desc",
  });
  return apiFetch<PageResponse<TableArea>>(
    `/api/v1/admin/orgs/${orgId}/branches/${branchId}/table-areas${query}`,
    { token }
  );
}

export async function createTableArea(
  token: string | null,
  orgId: string,
  branchId: string,
  body: { name: string }
): Promise<TableArea> {
  return apiFetch<TableArea>(
    `/api/v1/admin/orgs/${orgId}/branches/${branchId}/table-areas`,
    { token, body, method: "POST" }
  );
}

export async function updateTableArea(
  token: string | null,
  orgId: string,
  branchId: string,
  tableAreaId: string,
  body: { name: string }
): Promise<TableArea> {
  return apiFetch<TableArea>(
    `/api/v1/admin/orgs/${orgId}/branches/${branchId}/table-areas/${tableAreaId}`,
    { token, body, method: "PATCH" }
  );
}
