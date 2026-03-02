import { apiFetch } from "@/api/client";
import type { TenderType } from "@/types/sales";

export async function fetchTenderTypes(
  token: string | null,
  orgId: string,
  params?: { includeInactive?: boolean }
): Promise<TenderType[]> {
  const query =
    params?.includeInactive === true ? "?includeInactive=true" : "";
  const res = await apiFetch<TenderType[]>(
    `/api/v1/admin/orgs/${orgId}/tender-types${query}`,
    { token }
  );
  return Array.isArray(res) ? res : [];
}

export async function fetchTenderType(
  token: string | null,
  orgId: string,
  tenderTypeId: string
): Promise<TenderType> {
  return apiFetch<TenderType>(
    `/api/v1/admin/orgs/${orgId}/tender-types/${tenderTypeId}`,
    { token }
  );
}

export interface CreateTenderTypeBody {
  code: string;
  name: string;
}

export async function createTenderType(
  token: string | null,
  orgId: string,
  body: CreateTenderTypeBody
): Promise<TenderType> {
  return apiFetch<TenderType>(`/api/v1/admin/orgs/${orgId}/tender-types`, {
    token,
    method: "POST",
    body: { code: body.code.trim(), name: body.name.trim() },
  });
}

export interface UpdateTenderTypeBody {
  code: string;
  name: string;
  active: boolean;
}

export async function updateTenderType(
  token: string | null,
  orgId: string,
  tenderTypeId: string,
  body: UpdateTenderTypeBody
): Promise<TenderType> {
  return apiFetch<TenderType>(
    `/api/v1/admin/orgs/${orgId}/tender-types/${tenderTypeId}`,
    {
      token,
      method: "PATCH",
      body: {
        code: body.code.trim(),
        name: body.name.trim(),
        active: body.active,
      },
    }
  );
}

export async function deleteTenderType(
  token: string | null,
  orgId: string,
  tenderTypeId: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/admin/orgs/${orgId}/tender-types/${tenderTypeId}`,
    { token, method: "DELETE" }
  );
}
