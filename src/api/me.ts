import { apiFetch } from "@/api/client";
import type { MeResponse } from "@/types/me";

export async function fetchMe(
  token: string | null,
  orgId: string
): Promise<MeResponse> {
  return apiFetch<MeResponse>(`/api/v1/me?orgId=${encodeURIComponent(orgId)}`, {
    token,
  });
}
