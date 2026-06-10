import { apiFetch } from "@/api/client";

export interface AssistantCitation {
  tool: string;
  requestId: string;
  asOf: string;
}

export interface AssistantQueryRequest {
  message: string;
  screen?: string;
  filters?: Record<string, string>;
}

export interface AssistantQueryResponse {
  answer: string;
  intent: string;
  suggestions: string[];
  data?: Record<string, unknown>;
  citations?: AssistantCitation[];
  requestId?: string;
  dataAsOf?: string;
  llmUsed?: boolean;
  latencyMs?: number;
}

export interface AssistantUsageSummary {
  days: number;
  totalQueries: number;
  llmTokensUsed: number;
  topIntents: Array<{ intent: string; count: number }>;
}

export interface AssistantSettings {
  llmConfigured: boolean;
  llmEnabled: boolean;
  model: string;
  maxTokensPerDayPerOrg: number;
  rateLimitPerHour: number;
}

export async function queryAssistant(
  token: string | null,
  orgId: string,
  branchId: string,
  request: AssistantQueryRequest
): Promise<AssistantQueryResponse> {
  return apiFetch<AssistantQueryResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/assistant/query`,
    {
      token,
      method: "POST",
      body: request,
    }
  );
}

export async function fetchAssistantUsage(
  token: string | null,
  orgId: string,
  days = 7
): Promise<AssistantUsageSummary> {
  return apiFetch<AssistantUsageSummary>(
    `/api/v1/admin/orgs/${orgId}/assistant/usage?days=${days}`,
    { token }
  );
}

export async function fetchAssistantSettings(
  token: string | null,
  orgId: string
): Promise<AssistantSettings> {
  return apiFetch<AssistantSettings>(`/api/v1/admin/orgs/${orgId}/assistant/settings`, {
    token,
  });
}
