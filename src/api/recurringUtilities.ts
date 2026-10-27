import { apiFetch } from "@/api/client";

export type RecurringUtilityApplyTiming = "BEGINNING_OF_MONTH" | "END_OF_MONTH";

export interface RecurringUtility {
  id: string;
  orgId: string;
  branchId: string;
  name: string;
  amount: number;
  applyTiming: RecurringUtilityApplyTiming;
  dueDayOfMonth: number;
  payee: string | null;
  accountNumber: string | null;
  incurredBy: string | null;
  notes: string | null;
  active: boolean;
  createdByStaffUserId: string | null;
  createdByStaffUserName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringUtilityCreateRequest {
  name: string;
  amount: number;
  applyTiming?: RecurringUtilityApplyTiming;
  dueDayOfMonth?: number;
  payee?: string;
  accountNumber?: string;
  incurredBy?: string;
  notes?: string;
}

export interface RecurringUtilityUpdateRequest {
  name?: string;
  amount?: number;
  applyTiming?: RecurringUtilityApplyTiming;
  dueDayOfMonth?: number;
  payee?: string;
  accountNumber?: string;
  incurredBy?: string;
  active?: boolean;
  notes?: string;
}

export interface RecurringUtilitySummaryResponse {
  activeCount: number;
  monthlyTotalAmount: number;
}

export interface RecurringUtilityListResponse {
  items: RecurringUtility[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export async function fetchRecurringUtilities(
  token: string | null,
  orgId: string,
  branchId: string,
  params?: {
    active?: boolean;
    query?: string;
    page?: number;
    size?: number;
    sort?: string;
  }
): Promise<RecurringUtilityListResponse> {
  const search = new URLSearchParams();
  const p = params ?? {};
  if (p.active !== undefined) search.set("active", String(p.active));
  if (p.query) search.set("query", p.query);
  if (p.page !== undefined) search.set("page", String(p.page));
  if (p.size !== undefined) search.set("size", String(p.size));
  if (p.sort) search.set("sort", p.sort);
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
): Promise<RecurringUtility> {
  return apiFetch<RecurringUtility>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/recurring-utilities`,
    { token, body, method: "POST" }
  );
}

export async function updateRecurringUtility(
  token: string | null,
  orgId: string,
  branchId: string,
  utilityId: string,
  body: RecurringUtilityUpdateRequest
): Promise<RecurringUtility> {
  return apiFetch<RecurringUtility>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/recurring-utilities/${utilityId}`,
    { token, body, method: "PATCH" }
  );
}

export async function deleteRecurringUtility(
  token: string | null,
  orgId: string,
  branchId: string,
  utilityId: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/recurring-utilities/${utilityId}`,
    { token, method: "DELETE" }
  );
}
