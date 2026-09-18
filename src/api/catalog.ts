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
