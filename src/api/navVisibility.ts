import { apiFetch } from "./client";

export interface NavVisibilityResponse {
  admin: Record<string, boolean>;
  operator: Record<string, boolean>;
  header: Record<string, boolean>;
  adminLabels: Record<string, string>;
  operatorLabels: Record<string, string>;
  headerLabels: Record<string, string>;
}

export interface NavVisibilityUpdateRequest {
  admin?: Record<string, boolean>;
  operator?: Record<string, boolean>;
  header?: Record<string, boolean>;
  adminLabels?: Record<string, string>;
  operatorLabels?: Record<string, string>;
  headerLabels?: Record<string, string>;
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
    header: res.header ?? {},
    adminLabels: res.adminLabels ?? {},
    operatorLabels: res.operatorLabels ?? {},
    headerLabels: res.headerLabels ?? {},
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
        header: data.header ?? {},
        adminLabels: data.adminLabels ?? {},
        operatorLabels: data.operatorLabels ?? {},
        headerLabels: data.headerLabels ?? {},
      },
      method: "PUT",
    }
  );
  return {
    admin: res.admin ?? {},
    operator: res.operator ?? {},
    header: res.header ?? {},
    adminLabels: res.adminLabels ?? {},
    operatorLabels: res.operatorLabels ?? {},
    headerLabels: res.headerLabels ?? {},
  };
}
