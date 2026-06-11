import { apiFetch } from "@/api/client";

export type MpesaEnvironment = "SANDBOX" | "PRODUCTION";
export type MpesaConfigStatus = "ACTIVE" | "INACTIVE";
export type MpesaStkStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"
  | "TIMEOUT";

export interface MpesaConfig {
  id: string;
  orgId: string;
  branchId: string | null;
  branchName: string | null;
  environment: MpesaEnvironment;
  consumerKey: string;
  consumerSecretMasked: string;
  passkeyMasked: string;
  shortcode: string;
  tillNumber: string | null;
  stkAutoComplete: boolean;
  callbackBaseUrl: string | null;
  status: MpesaConfigStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MpesaConfigCreateBody {
  environment: MpesaEnvironment;
  consumerKey: string;
  consumerSecret: string;
  passkey?: string | null;
  shortcode: string;
  tillNumber?: string | null;
  stkAutoComplete: boolean;
  callbackBaseUrl?: string | null;
  branchId?: string | null;
}

export interface MpesaConfigUpdateBody {
  environment?: MpesaEnvironment;
  consumerKey?: string;
  consumerSecret?: string;
  passkey?: string;
  shortcode?: string;
  tillNumber?: string | null;
  stkAutoComplete?: boolean;
  callbackBaseUrl?: string | null;
  status?: MpesaConfigStatus;
}

export interface MpesaStkStatusResponse {
  id: string;
  saleId: string;
  status: MpesaStkStatus;
  amount: number;
  phoneNumber: string;
  resultCode: number | null;
  resultDesc: string | null;
  mpesaReceiptNumber: string | null;
  tenderId: string | null;
  saleStatus: string;
  saleCompleted: boolean;
  createdAt: string;
  callbackAt: string | null;
}

export interface MpesaOperatorSettings {
  stkOperatorEnabled: boolean;
}

const adminMpesaBase = (orgId: string) => `/api/v1/admin/orgs/${orgId}/mpesa`;

export async function fetchMpesaOperatorSettingsAdmin(
  token: string | null,
  orgId: string
): Promise<MpesaOperatorSettings> {
  return apiFetch<MpesaOperatorSettings>(`${adminMpesaBase(orgId)}/operator-settings`, {
    token,
  });
}

export async function updateMpesaOperatorSettings(
  token: string | null,
  orgId: string,
  stkOperatorEnabled: boolean
): Promise<MpesaOperatorSettings> {
  return apiFetch<MpesaOperatorSettings>(`${adminMpesaBase(orgId)}/operator-settings`, {
    token,
    method: "PATCH",
    body: { stkOperatorEnabled },
  });
}

export async function fetchMpesaOperatorSettings(
  token: string | null,
  orgId: string
): Promise<MpesaOperatorSettings> {
  return apiFetch<MpesaOperatorSettings>(
    `/api/v1/operator/orgs/${orgId}/mpesa/operator-settings`,
    { token }
  );
}

const adminConfigsPath = (orgId: string) =>
  `${adminMpesaBase(orgId)}/configs`;

export async function fetchMpesaConfigs(
  token: string | null,
  orgId: string
): Promise<MpesaConfig[]> {
  return apiFetch<MpesaConfig[]>(adminConfigsPath(orgId), { token });
}

export async function createMpesaOrgConfig(
  token: string | null,
  orgId: string,
  body: MpesaConfigCreateBody
): Promise<MpesaConfig> {
  return apiFetch<MpesaConfig>(adminConfigsPath(orgId), {
    token,
    method: "POST",
    body,
  });
}

export async function createMpesaBranchConfig(
  token: string | null,
  orgId: string,
  branchId: string,
  body: Omit<MpesaConfigCreateBody, "branchId">
): Promise<MpesaConfig> {
  return apiFetch<MpesaConfig>(
    `${adminConfigsPath(orgId)}/branches/${branchId}`,
    { token, method: "POST", body }
  );
}

export async function updateMpesaConfig(
  token: string | null,
  orgId: string,
  configId: string,
  body: MpesaConfigUpdateBody
): Promise<MpesaConfig> {
  return apiFetch<MpesaConfig>(`${adminConfigsPath(orgId)}/${configId}`, {
    token,
    method: "PATCH",
    body,
  });
}

export async function deactivateMpesaConfig(
  token: string | null,
  orgId: string,
  configId: string
): Promise<void> {
  await apiFetch<void>(`${adminConfigsPath(orgId)}/${configId}`, {
    token,
    method: "DELETE",
  });
}

export async function verifyMpesaConfig(
  token: string | null,
  orgId: string,
  configId: string
): Promise<{ ok: boolean; environment: MpesaEnvironment; message: string }> {
  return apiFetch(`${adminConfigsPath(orgId)}/${configId}/verify`, {
    token,
    method: "POST",
  });
}

const stkPath = (
  orgId: string,
  branchId: string,
  terminalId: string,
  saleId: string
) =>
  `/api/v1/operator/orgs/${orgId}/branches/${branchId}/terminals/${terminalId}/sales/${saleId}/mpesa`;

export async function initiateMpesaStk(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  saleId: string,
  body: { phoneNumber: string; amount: number }
): Promise<MpesaStkStatusResponse> {
  return apiFetch<MpesaStkStatusResponse>(`${stkPath(orgId, branchId, terminalId, saleId)}/stk`, {
    token,
    method: "POST",
    body,
  });
}

export async function fetchMpesaStkStatus(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  saleId: string,
  stkRequestId: string
): Promise<MpesaStkStatusResponse> {
  return apiFetch<MpesaStkStatusResponse>(
    `${stkPath(orgId, branchId, terminalId, saleId)}/stk/${stkRequestId}`,
    { token }
  );
}
