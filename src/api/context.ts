import { apiFetch } from "./client";
import type { Org, Branch, Terminal, PageResponse } from "@/types";

export async function fetchOrgs(token: string | null): Promise<PageResponse<Org>> {
  return apiFetch<PageResponse<Org>>("/api/v1/admin/orgs?size=100&sort=name,asc", { token });
}

export async function fetchBranches(
  token: string | null,
  orgId: string
): Promise<PageResponse<Branch>> {
  return apiFetch<PageResponse<Branch>>(
    `/api/v1/admin/orgs/${orgId}/branches?size=100&sort=name,asc`,
    { token }
  );
}

export async function fetchTerminals(
  token: string | null,
  orgId: string,
  branchId: string
): Promise<PageResponse<Terminal>> {
  return apiFetch<PageResponse<Terminal>>(
    `/api/v1/admin/orgs/${orgId}/branches/${branchId}/terminals?size=100&sort=terminalCode,asc`,
    { token }
  );
}
