import { apiFetch } from "./client";

export interface NavVisibilityResponse {
  admin: Record<string, boolean>;
  operator: Record<string, boolean>;
}

export interface NavVisibilityUpdateRequest {
  admin?: Record<string, boolean>;
  operator?: Record<string, boolean>;
}

export async function fetchNavVisibility(
  token: string | null,
  orgId: string
): Promise<NavVisibilityResponse> {
  const res = await apiFetch<NavVisibilityResponse>(
    `/api/v1/admin/orgs/${orgId}/nav-visibility`,
    { token }
  );
  return {
    admin: res.admin ?? {},
    operator: res.operator ?? {},
  };
}

export async function updateNavVisibility(
  token: string | null,
  orgId: string,
  data: NavVisibilityUpdateRequest
): Promise<NavVisibilityResponse> {
  const res = await apiFetch<NavVisibilityResponse>(
    `/api/v1/admin/orgs/${orgId}/nav-visibility`,
    {
      token,
      body: {
        admin: data.admin ?? {},
        operator: data.operator ?? {},
      },
      method: "PUT",
    }
  );
  return {
    admin: res.admin ?? {},
    operator: res.operator ?? {},
  };
}
