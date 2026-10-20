import { apiFetch, buildPageQuery } from "@/api/client";
import type { TableEntityList, TableEntity } from "@/types/sales";
import type { PageResponse } from "@/types/api";

export async function fetchOperatorTables(
  token: string | null,
  orgId: string,
  branchId: string
): Promise<TableEntityList[]> {
  const res = await apiFetch<TableEntityList[]>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/tables`,
    { token }
  );
  return Array.isArray(res) ? res : [];
}

export async function fetchAdminTables(
  token: string | null,
  orgId: string,
  branchId: string,
  params?: { page?: number; size?: number; sort?: string }
): Promise<PageResponse<TableEntity>> {
  const query = buildPageQuery({
    page: params?.page ?? 0,
    size: params?.size ?? 25,
    sort: params?.sort ?? "createdAt,desc",
  });
  return apiFetch<PageResponse<TableEntity>>(
    `/api/v1/admin/orgs/${orgId}/branches/${branchId}/tables${query}`,
    { token }
  );
}

export interface CreateTableBody {
  tableAreaId: string | null;
  name: string;
  capacity: number | null;
}

export interface UpdateTableBody {
  tableAreaId: string | null;
  name: string;
  capacity: number | null;
  status: string;
}

export async function createAdminTable(
  token: string | null,
  orgId: string,
  branchId: string,
  body: CreateTableBody
): Promise<TableEntity> {
  return apiFetch<TableEntity>(
    `/api/v1/admin/orgs/${orgId}/branches/${branchId}/tables`,
    { token, body, method: "POST" }
  );
}

export async function updateAdminTable(
  token: string | null,
  orgId: string,
  branchId: string,
  tableId: string,
  body: UpdateTableBody
): Promise<TableEntity> {
  return apiFetch<TableEntity>(
    `/api/v1/admin/orgs/${orgId}/branches/${branchId}/tables/${tableId}`,
    { token, body, method: "PATCH" }
  );
}
