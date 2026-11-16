import { apiFetch } from "@/api/client";
import type { PageResponse } from "@/types/api";

export interface InsightEvent {
  id: string;
  branchId: string | null;
  insightType: string;
  severity: string;
  title: string;
  body: string;
  createdAt: string;
  acknowledgedAt: string | null;
}

export async function fetchInsightCount(
  token: string | null,
  orgId: string,
  branchId: string
): Promise<{ unacknowledged: number }> {
  return apiFetch<{ unacknowledged: number }>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/assistant/insights/count`,
    { token }
  );
}

export async function fetchInsights(
  token: string | null,
  orgId: string,
  branchId: string,
  page = 0,
  size = 10
): Promise<PageResponse<InsightEvent>> {
  return apiFetch<PageResponse<InsightEvent>>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/assistant/insights?page=${page}&size=${size}`,
    { token }
  );
}

export async function acknowledgeInsight(
  token: string | null,
  orgId: string,
  branchId: string,
  insightId: string
): Promise<InsightEvent> {
  return apiFetch<InsightEvent>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/assistant/insights/${insightId}/acknowledge`,
    { token, method: "POST" }
  );
}
