import { apiFetch, buildPageQuery } from "@/api/client";
import type { PageResponse } from "@/types/api";
import type { PriceList, PriceListItem } from "@/types/sales";

export async function fetchPriceLists(
  token: string | null,
  orgId: string,
  params?: { page?: number; size?: number }
): Promise<PageResponse<PriceList>> {
  const query = buildPageQuery({
    page: params?.page ?? 0,
    size: params?.size ?? 50,
    sort: "priority,asc",
  });
  return apiFetch<PageResponse<PriceList>>(
    `/api/v1/admin/orgs/${orgId}/price-lists${query}`,
    { token }
  );
}

export async function fetchPriceList(
  token: string | null,
  orgId: string,
  priceListId: string
): Promise<PriceList> {
  return apiFetch<PriceList>(
    `/api/v1/admin/orgs/${orgId}/price-lists/${priceListId}`,
    { token }
  );
}

export interface CreatePriceListBody {
  branchId: string | null;
  channel: string | null;
  name: string;
  priority: number;
  active: boolean;
}

export async function createPriceList(
  token: string | null,
  orgId: string,
  body: CreatePriceListBody
): Promise<PriceList> {
  return apiFetch<PriceList>(`/api/v1/admin/orgs/${orgId}/price-lists`, {
    token,
    method: "POST",
    body: {
      branchId: body.branchId,
      channel: body.channel,
      name: body.name,
      priority: body.priority,
      active: body.active,
    },
  });
}

export interface UpdatePriceListBody {
  branchId: string | null;
  channel: string | null;
  name: string;
  priority: number;
  active: boolean;
}

export async function deletePriceList(
  token: string | null,
  orgId: string,
  priceListId: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/admin/orgs/${orgId}/price-lists/${priceListId}`,
    { token, method: "DELETE" }
  );
}

export async function updatePriceList(
  token: string | null,
  orgId: string,
  priceListId: string,
  body: UpdatePriceListBody
): Promise<PriceList> {
  return apiFetch<PriceList>(
    `/api/v1/admin/orgs/${orgId}/price-lists/${priceListId}`,
    {
      token,
      method: "PATCH",
      body: {
        branchId: body.branchId,
        channel: body.channel,
        name: body.name,
        priority: body.priority,
        active: body.active,
      },
    }
  );
}

export async function fetchPriceListItems(
  token: string | null,
  orgId: string,
  priceListId: string
): Promise<PriceListItem[]> {
  const res = await apiFetch<PriceListItem[]>(
    `/api/v1/admin/orgs/${orgId}/price-lists/${priceListId}/items`,
    { token }
  );
  return Array.isArray(res) ? res : [];
}

export async function addPriceListItem(
  token: string | null,
  orgId: string,
  priceListId: string,
  itemId: string,
  price: number,
  currency: string
): Promise<PriceListItem> {
  return apiFetch<PriceListItem>(
    `/api/v1/admin/orgs/${orgId}/price-lists/${priceListId}/items`,
    {
      token,
      method: "POST",
      body: { itemId, price, currency: currency || "KES" },
    }
  );
}

export async function deletePriceListItem(
  token: string | null,
  orgId: string,
  priceListId: string,
  priceListItemId: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/admin/orgs/${orgId}/price-lists/${priceListId}/items/${priceListItemId}`,
    { token, method: "DELETE" }
  );
}
