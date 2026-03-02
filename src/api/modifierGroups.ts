import { apiFetch, buildPageQuery } from "@/api/client";
import type { ModifierGroup, ModifierOption } from "@/types/catalog";
import type { PageResponse } from "@/types/api";

export async function fetchModifierOptions(
  token: string | null,
  orgId: string,
  modifierGroupId: string
): Promise<ModifierOption[]> {
  const res = await apiFetch<PageResponse<ModifierOption>>(
    `/api/v1/admin/orgs/${orgId}/modifier-groups/${modifierGroupId}/options?size=50`,
    { token }
  );
  return res?.content ?? [];
}

export async function fetchModifierGroups(
  token: string | null,
  orgId: string,
  params?: { page?: number; size?: number }
): Promise<PageResponse<ModifierGroup>> {
  const query = buildPageQuery({
    page: params?.page ?? 0,
    size: params?.size ?? 200,
    sort: "name,asc",
  });
  return apiFetch<PageResponse<ModifierGroup>>(
    `/api/v1/admin/orgs/${orgId}/modifier-groups${query}`,
    { token }
  );
}
