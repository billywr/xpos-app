import { apiFetch } from "./client";
import type { Item, Category, ItemBarcode, PageResponse } from "@/types";

export async function fetchItems(
  token: string | null,
  orgId: string,
  params?: { page?: number; size?: number; categoryId?: string | null }
): Promise<PageResponse<Item>> {
  const query = new URLSearchParams();
  query.set("page", String(params?.page ?? 0));
  query.set("size", String(params?.size ?? 100));
  query.set("sort", "name,asc");
  if (params?.categoryId) {
    query.set("categoryId", params.categoryId);
  }
  return apiFetch<PageResponse<Item>>(
    `/api/v1/admin/orgs/${orgId}/items?${query.toString()}`,
    { token }
  );
}

export async function fetchCategories(
  token: string | null,
  orgId: string
): Promise<PageResponse<Category>> {
  return apiFetch<PageResponse<Category>>(
    `/api/v1/admin/orgs/${orgId}/categories?size=100&sort=name,asc`,
    { token }
  );
}

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

export interface CreateItemBody {
  sku?: string | null;
  name: string;
  itemType: string;
  categoryId?: string | null;
  taxProfileId?: string | null;
  trackInventory?: boolean;
  active?: boolean;
  buyingPrice?: number | null;
  defaultSellingPrice?: number | null;
  visibleInPos?: boolean;
  imageUrl?: string | null;
}

export interface UpdateItemBody {
  sku?: string | null;
  name?: string;
  itemType?: string;
  categoryId?: string | null;
  taxProfileId?: string | null;
  trackInventory?: boolean;
  active?: boolean;
  buyingPrice?: number | null;
  defaultSellingPrice?: number | null;
  visibleInPos?: boolean;
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
      taxProfileId: body.taxProfileId ?? null,
      trackInventory: body.trackInventory ?? false,
      active: body.active ?? true,
      buyingPrice: body.buyingPrice ?? null,
      defaultSellingPrice: body.defaultSellingPrice ?? null,
      visibleInPos: body.visibleInPos ?? true,
      imageUrl: body.imageUrl ?? null,
    },
  });
}

export async function updateItem(
  token: string | null,
  orgId: string,
  itemId: string,
  body: UpdateItemBody
): Promise<Item> {
  return apiFetch<Item>(`/api/v1/admin/orgs/${orgId}/items/${itemId}`, {
    token,
    method: "PATCH",
    body,
  });
}
