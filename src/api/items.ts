import { apiFetch, buildPageQuery } from "@/api/client";
import type { Item } from "@/types/catalog";
import type { ItemBarcode } from "@/types/catalog";
import type { ItemModifierGroupLink } from "@/types/catalog";
import type { PageResponse } from "@/types/api";

export async function fetchItems(
  token: string | null,
  orgId: string,
  params?: { page?: number; size?: number; categoryId?: string | null }
): Promise<PageResponse<Item>> {
  const query = buildPageQuery({
    page: params?.page ?? 0,
    size: params?.size ?? 100,
    sort: "name,asc",
  });
  const categoryParam =
    params?.categoryId && params.categoryId.trim()
      ? `&categoryId=${encodeURIComponent(params.categoryId)}`
      : "";
  return apiFetch<PageResponse<Item>>(
    `/api/v1/admin/orgs/${orgId}/items${query}${categoryParam}`,
    { token }
  );
}

export async function fetchItemIdsWithPrices(
  token: string | null,
  orgId: string
): Promise<{ itemIds: string[] }> {
  return apiFetch<{ itemIds: string[] }>(
    `/api/v1/admin/orgs/${orgId}/items/ids-with-prices`,
    { token }
  );
}

export async function fetchItem(
  token: string | null,
  orgId: string,
  itemId: string
): Promise<Item> {
  return apiFetch<Item>(
    `/api/v1/admin/orgs/${orgId}/items/${itemId}`,
    { token }
  );
}

/** Find item by barcode in this org. 404 if no item has this barcode. */
export async function fetchItemByBarcode(
  token: string | null,
  orgId: string,
  barcode: string
): Promise<Item> {
  const params = new URLSearchParams({ barcode: barcode.trim() });
  return apiFetch<Item>(
    `/api/v1/admin/orgs/${orgId}/items/by-barcode?${params.toString()}`,
    { token }
  );
}

export interface CreateItemBody {
  sku?: string | null;
  name: string;
  itemType: string;
  categoryId?: string | null;
  baseUomId?: string | null;
  taxProfileId?: string | null;
  trackInventory?: boolean;
  active?: boolean;
  buyingPrice?: number | null;
  defaultSellingPrice?: number | null;
  defaultPriceListId?: string | null;
  imageUrl?: string | null;
}

export async function createItem(
  token: string | null,
  orgId: string,
  body: CreateItemBody
): Promise<Item> {
  return apiFetch<Item>(`/api/v1/admin/orgs/${orgId}/items`, {
    token,
    method: "POST",
    body: {
      sku: body.sku ?? null,
      name: body.name,
      itemType: body.itemType,
      categoryId: body.categoryId ?? null,
      baseUomId: body.baseUomId ?? null,
      taxProfileId: body.taxProfileId ?? null,
      trackInventory: body.trackInventory ?? false,
      active: body.active ?? true,
      buyingPrice: body.buyingPrice ?? null,
      defaultSellingPrice: body.defaultSellingPrice ?? null,
      defaultPriceListId: body.defaultPriceListId ?? null,
      imageUrl: body.imageUrl ?? null,
    },
  });
}

export interface UpdateItemBody {
  sku?: string | null;
  name: string;
  itemType: string;
  categoryId?: string | null;
  baseUomId?: string | null;
  taxProfileId?: string | null;
  trackInventory?: boolean;
  active?: boolean;
  buyingPrice?: number | null;
  defaultSellingPrice?: number | null;
  defaultPriceListId?: string | null;
  imageUrl?: string | null;
}

export async function deleteItem(
  token: string | null,
  orgId: string,
  itemId: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/admin/orgs/${orgId}/items/${itemId}`,
    { token, method: "DELETE" }
  );
}

export async function updateItem(
  token: string | null,
  orgId: string,
  itemId: string,
  body: UpdateItemBody
): Promise<Item> {
  return apiFetch<Item>(
    `/api/v1/admin/orgs/${orgId}/items/${itemId}`,
    {
      token,
      method: "PATCH",
      body: {
        sku: body.sku ?? null,
        name: body.name,
        itemType: body.itemType,
        categoryId: body.categoryId ?? null,
        baseUomId: body.baseUomId ?? null,
        taxProfileId: body.taxProfileId ?? null,
        trackInventory: body.trackInventory ?? false,
        active: body.active ?? true,
        buyingPrice: body.buyingPrice ?? null,
        defaultSellingPrice: body.defaultSellingPrice ?? null,
        defaultPriceListId: body.defaultPriceListId ?? null,
        imageUrl: body.imageUrl ?? null,
      },
    }
  );
}

export async function fetchItemBarcodes(
  token: string | null,
  orgId: string,
  itemId: string
): Promise<ItemBarcode[]> {
  return apiFetch<ItemBarcode[]>(
    `/api/v1/admin/orgs/${orgId}/items/${itemId}/barcodes`,
    { token }
  );
}

export async function addItemBarcode(
  token: string | null,
  orgId: string,
  itemId: string,
  barcode: string
): Promise<ItemBarcode> {
  return apiFetch<ItemBarcode>(
    `/api/v1/admin/orgs/${orgId}/items/${itemId}/barcodes`,
    { token, method: "POST", body: { barcode } }
  );
}

export async function deleteItemBarcode(
  token: string | null,
  orgId: string,
  itemId: string,
  barcodeId: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/admin/orgs/${orgId}/items/${itemId}/barcodes/${barcodeId}`,
    { token, method: "DELETE" }
  );
}

export async function fetchItemModifierGroups(
  token: string | null,
  orgId: string,
  itemId: string
): Promise<ItemModifierGroupLink[]> {
  return apiFetch<ItemModifierGroupLink[]>(
    `/api/v1/admin/orgs/${orgId}/items/${itemId}/modifier-groups`,
    { token }
  );
}

export async function addItemModifierGroup(
  token: string | null,
  orgId: string,
  itemId: string,
  modifierGroupId: string
): Promise<ItemModifierGroupLink> {
  return apiFetch<ItemModifierGroupLink>(
    `/api/v1/admin/orgs/${orgId}/items/${itemId}/modifier-groups`,
    { token, method: "POST", body: { modifierGroupId } }
  );
}

export interface ItemImageUploadResponse {
  url: string;
}

export async function uploadItemImage(
  token: string | null,
  orgId: string,
  file: File
): Promise<ItemImageUploadResponse> {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
  const url = `${baseUrl}/api/v1/admin/orgs/${orgId}/item-images/upload`;
  const formData = new FormData();
  formData.append("file", file);

  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = data?.message ?? res.statusText ?? "Upload failed";
    throw { status: res.status, data: { ...data, message } };
  }

  return res.json() as Promise<ItemImageUploadResponse>;
}

export async function deleteItemModifierGroup(
  token: string | null,
  orgId: string,
  itemId: string,
  itemModifierGroupId: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/admin/orgs/${orgId}/items/${itemId}/modifier-groups/${itemModifierGroupId}`,
    { token, method: "DELETE" }
  );
}
