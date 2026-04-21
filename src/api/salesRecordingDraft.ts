import { apiFetch } from "@/api/client";

export interface SalesRecordingDraftResponse {
  exists: boolean;
  saleDate: string;
  qtyByItem: Record<string, string>;
  updatedAt: string | null;
}

function basePath(orgId: string, branchId: string, terminalId: string): string {
  return `/api/v1/operator/orgs/${orgId}/branches/${branchId}/terminals/${terminalId}/sales-recording/draft`;
}

export async function fetchSalesRecordingDraft(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  date: string
): Promise<SalesRecordingDraftResponse> {
  const params = new URLSearchParams({ date });
  return apiFetch<SalesRecordingDraftResponse>(
    `${basePath(orgId, branchId, terminalId)}?${params.toString()}`,
    { token }
  );
}

export async function saveSalesRecordingDraft(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  saleDate: string,
  qtyByItem: Record<string, string>
): Promise<SalesRecordingDraftResponse> {
  return apiFetch<SalesRecordingDraftResponse>(basePath(orgId, branchId, terminalId), {
    token,
    method: "PUT",
    body: { saleDate, qtyByItem },
  });
}

export async function deleteSalesRecordingDraft(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  date: string
): Promise<void> {
  const params = new URLSearchParams({ date });
  await apiFetch<void>(
    `${basePath(orgId, branchId, terminalId)}?${params.toString()}`,
    { token, method: "DELETE" }
  );
}
