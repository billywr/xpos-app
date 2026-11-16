import { apiFetch, buildPageQuery } from "@/api/client";
import type { PageResponse } from "@/types/api";

export interface Supplier {
  id: string;
  orgId: string;
  name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchSuppliers(
  token: string | null,
  orgId: string,
  params?: { page?: number; size?: number; includeInactive?: boolean; sort?: string }
): Promise<PageResponse<Supplier>> {
  const query = buildPageQuery({
    page: params?.page ?? 0,
    size: params?.size ?? 100,
    sort: params?.sort ?? "createdAt,desc",
  });
  const includeInactive = params?.includeInactive ? "&includeInactive=true" : "";
  return apiFetch<PageResponse<Supplier>>(
    `/api/v1/admin/orgs/${orgId}/suppliers${query}${includeInactive}`,
    { token }
  );
}

export async function fetchSupplier(
  token: string | null,
  orgId: string,
  supplierId: string
): Promise<Supplier> {
  return apiFetch<Supplier>(
    `/api/v1/admin/orgs/${orgId}/suppliers/${supplierId}`,
    { token }
  );
}

export interface CreateSupplierBody {
  name: string;
  phone?: string | null;
  email?: string | null;
}

export interface UpdateSupplierBody {
  name: string;
  phone?: string | null;
  email?: string | null;
  active?: boolean;
}

export async function updateSupplier(
  token: string | null,
  orgId: string,
  supplierId: string,
  body: UpdateSupplierBody
): Promise<Supplier> {
  return apiFetch<Supplier>(
    `/api/v1/admin/orgs/${orgId}/suppliers/${supplierId}`,
    {
      token,
      method: "PATCH",
      body: {
        name: body.name,
        phone: body.phone ?? null,
        email: body.email ?? null,
        active: body.active,
      },
    }
  );
}

export async function createSupplier(
  token: string | null,
  orgId: string,
  body: CreateSupplierBody
): Promise<Supplier> {
  return apiFetch<Supplier>(`/api/v1/admin/orgs/${orgId}/suppliers`, {
    token,
    method: "POST",
    body: {
      name: body.name,
      phone: body.phone ?? null,
      email: body.email ?? null,
    },
  });
}
