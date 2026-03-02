import { apiFetch, buildPageQuery } from "@/api/client";
import type { Item } from "@/types/catalog";
import type { ItemBarcode } from "@/types/catalog";
import type { ItemModifierGroupLink } from "@/types/catalog";
import type { PageResponse } from "@/types/api";

export async function fetchItems(
  token: string | null,
  orgId: string,
  params?: { page?: number; size?: number }
): Promise<PageResponse<Item>> {
  const query = buildPageQuery({
    page: params?.page ?? 0,
    size: params?.size ?? 100,
    sort: "name,asc",
  });
  return apiFetch<PageResponse<Item>>(
    `/api/v1/admin/orgs/${orgId}/items${query}`,
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

export interface CreateItemBody {
  sku?: string | null;
  name: string;
  itemType: string;
  categoryId?: string | null;
  baseUomId?: string | null;
  taxProfileId?: string | null;
  trackInventory?: boolean;
  active?: boolean;
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
