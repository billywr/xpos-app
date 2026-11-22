import { apiFetch } from "./client";
import type {
  RecurringUtilityResponse,
  RecurringUtilityCreateRequest,
  RecurringUtilityUpdateRequest,
  RecurringUtilityListResponse,
  RecurringUtilitySummaryResponse,
} from "@/types";

export async function fetchRecurringUtilities(
  token: string | null,
  orgId: string,
  branchId: string,
  params?: {
    active?: boolean;
    startDate?: string;
    endDate?: string;
    page?: number;
    size?: number;
  }
): Promise<RecurringUtilityListResponse> {
  const search = new URLSearchParams();
  if (params?.active !== undefined) search.set("active", String(params.active));
  if (params?.startDate) search.set("startDate", params.startDate);
  if (params?.endDate) search.set("endDate", params.endDate);
  if (params?.page !== undefined) search.set("page", String(params.page));
  if (params?.size !== undefined) search.set("size", String(params.size));
  const qs = search.toString();
  return apiFetch<RecurringUtilityListResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/recurring-utilities${qs ? `?${qs}` : ""}`,
    { token }
  );
}

export async function fetchRecurringUtilitySummary(
  token: string | null,
  orgId: string,
  branchId: string
): Promise<RecurringUtilitySummaryResponse> {
  return apiFetch<RecurringUtilitySummaryResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/recurring-utilities/summary`,
    { token }
  );
}

export async function createRecurringUtility(
  token: string | null,
  orgId: string,
  branchId: string,
  body: RecurringUtilityCreateRequest
): Promise<RecurringUtilityResponse> {
  return apiFetch<RecurringUtilityResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/recurring-utilities`,
    { token, method: "POST", body }
  );
}

export async function updateRecurringUtility(
  token: string | null,
  orgId: string,
  branchId: string,
  utilityId: string,
  body: RecurringUtilityUpdateRequest
): Promise<RecurringUtilityResponse> {
  return apiFetch<RecurringUtilityResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/recurring-utilities/${utilityId}`,
    { token, method: "PUT", body }
  );
}

export async function deleteRecurringUtility(
  token: string | null,
  orgId: string,
  branchId: string,
  utilityId: string
): Promise<void> {
  return apiFetch<void>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/recurring-utilities/${utilityId}`,
    { token, method: "DELETE" }
  );
}
