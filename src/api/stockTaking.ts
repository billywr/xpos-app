import { apiFetch, buildPageQuery } from "@/api/client";
import type { PageResponse } from "@/types/api";

// === Stock Taking Schedules (admin) ===

export interface StockTakingScheduleResponse {
  id: string;
  orgId: string;
  branchId: string;
  frequency: "DAILY" | "WEEKLY";
  dayOfWeek: number | null;
  scheduledHour: number;
  scheduledMinute: number;
  isActive: boolean;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockTakingScheduleCreateRequest {
  branchId: string;
  frequency: "DAILY" | "WEEKLY";
  dayOfWeek?: number | null;
  scheduledHour: number;
  scheduledMinute: number;
}

export interface StockTakingScheduleUpdateRequest {
  frequency: "DAILY" | "WEEKLY";
  dayOfWeek?: number | null;
  scheduledHour: number;
  scheduledMinute: number;
  isActive: boolean;
}

export async function fetchStockTakingSchedules(
  token: string | null,
  orgId: string,
  params?: { page?: number; size?: number; sort?: string }
): Promise<PageResponse<StockTakingScheduleResponse>> {
  const query = buildPageQuery({
    page: params?.page ?? 0,
    size: params?.size ?? 20,
    sort: params?.sort ?? "createdAt,desc",
  });
  return apiFetch<PageResponse<StockTakingScheduleResponse>>(
    `/api/v1/admin/orgs/${orgId}/stock-taking-schedules${query}`,
    { token }
  );
}

export async function fetchStockTakingScheduleByBranch(
  token: string | null,
  orgId: string,
  branchId: string
): Promise<StockTakingScheduleResponse> {
  return apiFetch<StockTakingScheduleResponse>(
    `/api/v1/admin/orgs/${orgId}/stock-taking-schedules/by-branch?branchId=${branchId}`,
    { token }
  );
}

export async function fetchStockTakingSchedule(
  token: string | null,
  orgId: string,
  scheduleId: string
): Promise<StockTakingScheduleResponse> {
  return apiFetch<StockTakingScheduleResponse>(
    `/api/v1/admin/orgs/${orgId}/stock-taking-schedules/${scheduleId}`,
    { token }
  );
}

export async function createStockTakingSchedule(
  token: string | null,
  orgId: string,
  body: StockTakingScheduleCreateRequest
): Promise<StockTakingScheduleResponse> {
  return apiFetch<StockTakingScheduleResponse>(
    `/api/v1/admin/orgs/${orgId}/stock-taking-schedules`,
    { token, method: "POST", body }
  );
}

export async function updateStockTakingSchedule(
  token: string | null,
  orgId: string,
  scheduleId: string,
  body: StockTakingScheduleUpdateRequest
): Promise<StockTakingScheduleResponse> {
  return apiFetch<StockTakingScheduleResponse>(
    `/api/v1/admin/orgs/${orgId}/stock-taking-schedules/${scheduleId}`,
    { token, method: "PUT", body }
  );
}

export async function deleteStockTakingSchedule(
  token: string | null,
  orgId: string,
  scheduleId: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/admin/orgs/${orgId}/stock-taking-schedules/${scheduleId}`,
    { token, method: "DELETE" }
  );
}

export async function triggerStockTakingSchedule(
  token: string | null,
  orgId: string,
  scheduleId: string
): Promise<StockCountSessionResponse> {
  return apiFetch<StockCountSessionResponse>(
    `/api/v1/admin/orgs/${orgId}/stock-taking-schedules/${scheduleId}/trigger`,
    { token, method: "POST" }
  );
}

// === Stock Count Sessions ===

export interface StockCountLineResponse {
  id: string;
  sessionId: string;
  itemId: string;
  itemName: string;
  countedQty: number;
  systemQty: number;
  varianceQty: number;
  unitCost: number | null;
  qtySold: number;
  sellingPrice: number | null;
  createdAt: string;
}

export interface StockCountSessionResponse {
  id: string;
  orgId: string;
  branchId: string;
  status: string;
  sourceType: "MANUAL" | "SCHEDULED";
  scheduleId: string | null;
  startedByStaffUserId: string;
  startedAt: string;
  closedByStaffUserId: string | null;
  closedAt: string | null;
  lines: StockCountLineResponse[];
}

// Admin stock count sessions
export async function fetchAdminStockCountSessions(
  token: string | null,
  orgId: string,
  branchId: string,
  params?: { page?: number; size?: number }
): Promise<PageResponse<StockCountSessionResponse>> {
  const search = new URLSearchParams();
  search.set("branchId", branchId);
  if (params?.page !== undefined) search.set("page", String(params.page));
  if (params?.size !== undefined) search.set("size", String(params.size));
  search.set("sort", "startedAt,desc");
  return apiFetch<PageResponse<StockCountSessionResponse>>(
    `/api/v1/admin/orgs/${orgId}/stock-count-sessions?${search.toString()}`,
    { token }
  );
}

export async function startAdminStockCountSession(
  token: string | null,
  orgId: string,
  body: { branchId: string }
): Promise<StockCountSessionResponse> {
  return apiFetch<StockCountSessionResponse>(
    `/api/v1/admin/orgs/${orgId}/stock-count-sessions`,
    { token, method: "POST", body }
  );
}

export async function fetchAdminStockCountSession(
  token: string | null,
  orgId: string,
  sessionId: string
): Promise<StockCountSessionResponse> {
  return apiFetch<StockCountSessionResponse>(
    `/api/v1/admin/orgs/${orgId}/stock-count-sessions/${sessionId}`,
    { token }
  );
}

export async function addStockCountLine(
  token: string | null,
  orgId: string,
  sessionId: string,
  body: { itemId: string; countedQty: number }
): Promise<StockCountSessionResponse> {
  return apiFetch<StockCountSessionResponse>(
    `/api/v1/admin/orgs/${orgId}/stock-count-sessions/${sessionId}/lines`,
    { token, method: "POST", body }
  );
}

export async function updateStockCountLine(
  token: string | null,
  orgId: string,
  sessionId: string,
  lineId: string,
  body: { countedQty: number }
): Promise<StockCountSessionResponse> {
  return apiFetch<StockCountSessionResponse>(
    `/api/v1/admin/orgs/${orgId}/stock-count-sessions/${sessionId}/lines/${lineId}`,
    { token, method: "PATCH", body }
  );
}

export async function deleteStockCountLine(
  token: string | null,
  orgId: string,
  sessionId: string,
  lineId: string
): Promise<StockCountSessionResponse> {
  return apiFetch<StockCountSessionResponse>(
    `/api/v1/admin/orgs/${orgId}/stock-count-sessions/${sessionId}/lines/${lineId}`,
    { token, method: "DELETE" }
  );
}

export async function closeStockCountSession(
  token: string | null,
  orgId: string,
  sessionId: string
): Promise<StockCountSessionResponse> {
  return apiFetch<StockCountSessionResponse>(
    `/api/v1/admin/orgs/${orgId}/stock-count-sessions/${sessionId}/close`,
    { token, method: "POST" }
  );
}

/** Admin: soft-delete a stock count session (OPEN or CLOSED). */
export async function deleteAdminStockCountSession(
  token: string | null,
  orgId: string,
  sessionId: string
): Promise<StockCountSessionResponse> {
  return apiFetch<StockCountSessionResponse>(
    `/api/v1/admin/orgs/${orgId}/stock-count-sessions/${sessionId}`,
    { token, method: "DELETE" }
  );
}

// Operator stock count sessions (branch-scoped)
export async function fetchOperatorStockCountSessions(
  token: string | null,
  orgId: string,
  branchId: string,
  params?: { page?: number; size?: number }
): Promise<PageResponse<StockCountSessionResponse>> {
  const query = buildPageQuery({ ...params, sort: "startedAt,desc" });
  return apiFetch<PageResponse<StockCountSessionResponse>>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/stock-count-sessions${query}`,
    { token }
  );
}

export async function startOperatorStockCountSession(
  token: string | null,
  orgId: string,
  branchId: string
): Promise<StockCountSessionResponse> {
  return apiFetch<StockCountSessionResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/stock-count-sessions`,
    { token, method: "POST" }
  );
}

export async function fetchOperatorStockCountSession(
  token: string | null,
  orgId: string,
  branchId: string,
  sessionId: string
): Promise<StockCountSessionResponse> {
  return apiFetch<StockCountSessionResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/stock-count-sessions/${sessionId}`,
    { token }
  );
}

export async function addOperatorStockCountLine(
  token: string | null,
  orgId: string,
  branchId: string,
  sessionId: string,
  body: { itemId: string; countedQty: number }
): Promise<StockCountSessionResponse> {
  return apiFetch<StockCountSessionResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/stock-count-sessions/${sessionId}/lines`,
    { token, method: "POST", body }
  );
}

export async function updateOperatorStockCountLine(
  token: string | null,
  orgId: string,
  branchId: string,
  sessionId: string,
  lineId: string,
  body: { countedQty: number }
): Promise<StockCountSessionResponse> {
  return apiFetch<StockCountSessionResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/stock-count-sessions/${sessionId}/lines/${lineId}`,
    { token, method: "PATCH", body }
  );
}

export async function deleteOperatorStockCountLine(
  token: string | null,
  orgId: string,
  branchId: string,
  sessionId: string,
  lineId: string
): Promise<StockCountSessionResponse> {
  return apiFetch<StockCountSessionResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/stock-count-sessions/${sessionId}/lines/${lineId}`,
    { token, method: "DELETE" }
  );
}

export async function closeOperatorStockCountSession(
  token: string | null,
  orgId: string,
  branchId: string,
  sessionId: string
): Promise<StockCountSessionResponse> {
  return apiFetch<StockCountSessionResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/stock-count-sessions/${sessionId}/close`,
    { token, method: "POST" }
  );
}

/** Operator: soft-delete a stock count session (OPEN or CLOSED). */
export async function deleteOperatorStockCountSession(
  token: string | null,
  orgId: string,
  branchId: string,
  sessionId: string
): Promise<StockCountSessionResponse> {
  return apiFetch<StockCountSessionResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/stock-count-sessions/${sessionId}`,
    { token, method: "DELETE" }
  );
}
