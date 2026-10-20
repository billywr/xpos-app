import { apiFetch, buildPageQuery } from "@/api/client";
import type { Org } from "@/types/org";
import type { PageResponse } from "@/types/api";

export async function fetchOrgs(
  token: string | null,
  params?: { page?: number; size?: number; sort?: string }
): Promise<PageResponse<Org>> {
  const query = buildPageQuery({
    page: params?.page ?? 0,
    size: params?.size ?? 25,
    sort: params?.sort ?? "createdAt,desc",
  });
  return apiFetch<PageResponse<Org>>(`/api/v1/admin/orgs${query}`, { token });
}

export async function fetchOrg(
  token: string | null,
  orgId: string
): Promise<Org> {
  return apiFetch<Org>(`/api/v1/admin/orgs/${orgId}`, { token });
}

export interface CreateOrgBody {
  name: string;
}

export async function createOrg(
  token: string | null,
  body: CreateOrgBody
): Promise<Org> {
  return apiFetch<Org>("/api/v1/admin/orgs", {
    token,
    body,
    method: "POST",
  });
}

export interface UpdateOrgBody {
  name?: string;
  status?: string;
}

export async function updateOrg(
  token: string | null,
  orgId: string,
  body: UpdateOrgBody
): Promise<Org> {
  return apiFetch<Org>(`/api/v1/admin/orgs/${orgId}`, {
    token,
    body,
    method: "PATCH",
  });
}

export async function deleteOrg(
  token: string | null,
  orgId: string
): Promise<void> {
  await apiFetch<void>(`/api/v1/admin/orgs/${orgId}`, {
    token,
    method: "DELETE",
  });
}
