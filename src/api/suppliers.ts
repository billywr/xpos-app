import { apiFetch } from "./client";
import type { PageResponse } from "@/types";

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
  params?: { page?: number; size?: number; includeInactive?: boolean }
): Promise<PageResponse<Supplier>> {
  const search = new URLSearchParams();
  search.set("page", String(params?.page ?? 0));
  search.set("size", String(params?.size ?? 100));
  search.set("sort", "name,asc");
  if (params?.includeInactive) search.set("includeInactive", "true");
  const query = search.toString();
  return apiFetch<PageResponse<Supplier>>(
    `/api/v1/admin/orgs/${orgId}/suppliers?${query}`,
    { token }
  );
}
