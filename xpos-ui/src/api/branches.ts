import { apiFetch, buildPageQuery } from "@/api/client";
import type { Branch } from "@/types/org";
import type { PageResponse } from "@/types/api";

export async function fetchBranches(
  token: string | null,
  orgId: string,
  params?: { page?: number; size?: number; sort?: string }
): Promise<PageResponse<Branch>> {
  const query = buildPageQuery({
    page: params?.page ?? 0,
    size: params?.size ?? 25,
    sort: params?.sort ?? "createdAt,desc",
  });
  return apiFetch<PageResponse<Branch>>(
    `/api/v1/admin/orgs/${orgId}/branches${query}`,
    { token }
  );
}

export async function fetchBranch(
  token: string | null,
  orgId: string,
  branchId: string
): Promise<Branch> {
  return apiFetch<Branch>(
    `/api/v1/admin/orgs/${orgId}/branches/${branchId}`,
    { token }
  );
}

export interface CreateBranchBody {
  businessId: string;
  name: string;
  timezone: string;
  currency: string;
  addressJson?: string | null;
  taxAgencyConfigId?: string | null;
  receiptTemplateId?: string | null;
}

export interface UpdateBranchBody {
  businessId?: string;
  name?: string;
  timezone?: string;
  currency?: string;
  status?: string;
  addressJson?: string | null;
  taxAgencyConfigId?: string | null;
  receiptTemplateId?: string | null;
}

export async function createBranch(
  token: string | null,
  orgId: string,
  body: CreateBranchBody
): Promise<Branch> {
  return apiFetch<Branch>(`/api/v1/admin/orgs/${orgId}/branches`, {
    token,
    body: {
      businessId: body.businessId,
      name: body.name,
      timezone: body.timezone,
      currency: body.currency,
      addressJson: body.addressJson ?? null,
      taxAgencyConfigId: body.taxAgencyConfigId ?? null,
      receiptTemplateId: body.receiptTemplateId ?? null,
    },
    method: "POST",
  });
}

export async function updateBranch(
  token: string | null,
  orgId: string,
  branchId: string,
  body: UpdateBranchBody
): Promise<Branch> {
  return apiFetch<Branch>(
    `/api/v1/admin/orgs/${orgId}/branches/${branchId}`,
    {
      token,
      body: {
        ...(body.businessId !== undefined && { businessId: body.businessId }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.timezone !== undefined && { timezone: body.timezone }),
        ...(body.currency !== undefined && { currency: body.currency }),
        ...(body.status !== undefined && { status: body.status }),
        addressJson: body.addressJson ?? null,
        taxAgencyConfigId: body.taxAgencyConfigId ?? null,
        receiptTemplateId: body.receiptTemplateId ?? null,
      },
      method: "PATCH",
    }
  );
}

export async function deleteBranch(
  token: string | null,
  orgId: string,
  branchId: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/admin/orgs/${orgId}/branches/${branchId}`,
    { token, method: "DELETE" }
  );
}
