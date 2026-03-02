import { apiFetch, buildPageQuery } from "@/api/client";
import type { Terminal } from "@/types/org";
import type { PageResponse } from "@/types/api";

export async function fetchTerminals(
  token: string | null,
  orgId: string,
  branchId: string,
  params?: { page?: number; size?: number }
): Promise<PageResponse<Terminal>> {
  const query = buildPageQuery({
    page: params?.page ?? 0,
    size: params?.size ?? 25,
    sort: "terminalCode,asc",
  });
  return apiFetch<PageResponse<Terminal>>(
    `/api/v1/admin/orgs/${orgId}/branches/${branchId}/terminals${query}`,
    { token }
  );
}

export async function fetchTerminal(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string
): Promise<Terminal> {
  return apiFetch<Terminal>(
    `/api/v1/admin/orgs/${orgId}/branches/${branchId}/terminals/${terminalId}`,
    { token }
  );
}

export interface CreateTerminalBody {
  terminalCode: string;
  printerProfileId?: string | null;
}

export interface UpdateTerminalBody {
  terminalCode: string;
  printerProfileId?: string | null;
}

export async function createTerminal(
  token: string | null,
  orgId: string,
  branchId: string,
  body: CreateTerminalBody
): Promise<Terminal> {
  return apiFetch<Terminal>(
    `/api/v1/admin/orgs/${orgId}/branches/${branchId}/terminals`,
    {
      token,
      body: {
        terminalCode: body.terminalCode,
        printerProfileId: body.printerProfileId ?? null,
      },
      method: "POST",
    }
  );
}

export async function updateTerminal(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  body: UpdateTerminalBody
): Promise<Terminal> {
  return apiFetch<Terminal>(
    `/api/v1/admin/orgs/${orgId}/branches/${branchId}/terminals/${terminalId}`,
    {
      token,
      body: {
        terminalCode: body.terminalCode,
        printerProfileId: body.printerProfileId ?? null,
      },
      method: "PATCH",
    }
  );
}

export async function bindDeviceToTerminal(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  deviceRegistrationId: string
): Promise<unknown> {
  return apiFetch<unknown>(
    `/api/v1/admin/orgs/${orgId}/branches/${branchId}/terminals/${terminalId}/bind-device`,
    {
      token,
      body: { deviceRegistrationId },
      method: "POST",
    }
  );
}

export async function deleteTerminal(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/admin/orgs/${orgId}/branches/${branchId}/terminals/${terminalId}`,
    { token, method: "DELETE" }
  );
}
