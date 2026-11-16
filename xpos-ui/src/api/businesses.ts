import { apiFetch, buildPageQuery } from "@/api/client";
import type { Business } from "@/types/org";
import type { PageResponse } from "@/types/api";

export async function fetchBusinesses(
  token: string | null,
  orgId: string,
  params?: { page?: number; size?: number; sort?: string }
): Promise<PageResponse<Business>> {
  const query = buildPageQuery({
    page: params?.page ?? 0,
    size: params?.size ?? 100,
    sort: params?.sort ?? "createdAt,desc",
  });
  return apiFetch<PageResponse<Business>>(
    `/api/v1/admin/orgs/${orgId}/businesses${query}`,
    { token }
  );
}

export async function fetchBusiness(
  token: string | null,
  orgId: string,
  businessId: string
): Promise<Business> {
  return apiFetch<Business>(
    `/api/v1/admin/orgs/${orgId}/businesses/${businessId}`,
    { token }
  );
}

export interface CreateBusinessBody {
  legalName: string;
  kraPin?: string | null;
  logoUrl?: string | null;
  receiptFooter?: string | null;
}

export async function createBusiness(
  token: string | null,
  orgId: string,
  body: CreateBusinessBody
): Promise<Business> {
  return apiFetch<Business>(`/api/v1/admin/orgs/${orgId}/businesses`, {
    token,
    method: "POST",
    body: {
      legalName: body.legalName,
      kraPin: body.kraPin ?? null,
      logoUrl: body.logoUrl ?? null,
      receiptFooter: body.receiptFooter ?? null,
    },
  });
}

export interface UpdateBusinessBody {
  legalName?: string;
  kraPin?: string | null;
  logoUrl?: string | null;
  receiptFooter?: string | null;
}

export async function updateBusiness(
  token: string | null,
  orgId: string,
  businessId: string,
  body: UpdateBusinessBody
): Promise<Business> {
  return apiFetch<Business>(
    `/api/v1/admin/orgs/${orgId}/businesses/${businessId}`,
    {
      token,
      method: "PATCH",
      body: {
        ...(body.legalName !== undefined && { legalName: body.legalName }),
        ...(body.kraPin !== undefined && { kraPin: body.kraPin }),
        ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
        ...(body.receiptFooter !== undefined && { receiptFooter: body.receiptFooter }),
      },
    }
  );
}

export async function deleteBusiness(
  token: string | null,
  orgId: string,
  businessId: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/admin/orgs/${orgId}/businesses/${businessId}`,
    { token, method: "DELETE" }
  );
}
