import { apiFetch, buildPageQuery } from "@/api/client";
import type { DeviceRegistration } from "@/types/org";
import type { PageResponse } from "@/types/api";

export async function fetchDevices(
  token: string | null,
  orgId: string,
  params?: { page?: number; size?: number; sort?: string }
): Promise<PageResponse<DeviceRegistration>> {
  const query = buildPageQuery({
    page: params?.page ?? 0,
    size: params?.size ?? 25,
    sort: params?.sort ?? "createdAt,desc",
  });
  return apiFetch<PageResponse<DeviceRegistration>>(
    `/api/v1/admin/orgs/${orgId}/devices${query}`,
    { token }
  );
}

export async function fetchDevice(
  token: string | null,
  orgId: string,
  deviceRegistrationId: string
): Promise<DeviceRegistration> {
  return apiFetch<DeviceRegistration>(
    `/api/v1/admin/orgs/${orgId}/devices/${deviceRegistrationId}`,
    { token }
  );
}

export interface RegisterDeviceBody {
  deviceId: string;
  deviceFingerprint?: string | null;
}

export async function registerDevice(
  token: string | null,
  orgId: string,
  branchId: string,
  body: RegisterDeviceBody
): Promise<DeviceRegistration> {
  return apiFetch<DeviceRegistration>(
    `/api/v1/admin/orgs/${orgId}/branches/${branchId}/devices/register`,
    {
      token,
      body: {
        deviceId: body.deviceId,
        deviceFingerprint: body.deviceFingerprint ?? null,
      },
      method: "POST",
    }
  );
}

export async function activateDevice(
  token: string | null,
  orgId: string,
  deviceRegistrationId: string
): Promise<DeviceRegistration> {
  return apiFetch<DeviceRegistration>(
    `/api/v1/admin/orgs/${orgId}/devices/${deviceRegistrationId}/activate`,
    { token, method: "POST" }
  );
}

export async function deactivateDevice(
  token: string | null,
  orgId: string,
  deviceRegistrationId: string
): Promise<DeviceRegistration> {
  return apiFetch<DeviceRegistration>(
    `/api/v1/admin/orgs/${orgId}/devices/${deviceRegistrationId}/deactivate`,
    { token, method: "POST" }
  );
}

export async function deleteDevice(
  token: string | null,
  orgId: string,
  deviceRegistrationId: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/admin/orgs/${orgId}/devices/${deviceRegistrationId}`,
    { token, method: "DELETE" }
  );
}
