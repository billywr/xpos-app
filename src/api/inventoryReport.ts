import { apiFetch } from "@/api/client";
import type { PageParams, PageResponse } from "@/types/api";

export interface InventoryReportLineResponse {
  itemId: string;
  itemName: string;
  sku: string | null;
  onHandQty: number;
  soldQty: number;
  reservedQty: number;
  receivedQty: number;
  trackInventory: boolean;
}

export async function fetchInventoryReport(
  token: string | null,
  orgId: string,
  branchId: string,
  params?: PageParams
): Promise<PageResponse<InventoryReportLineResponse>> {
  const search = new URLSearchParams();
  search.set("branchId", branchId);
  if (params?.page !== undefined) search.set("page", String(params.page));
  if (params?.size !== undefined) search.set("size", String(params.size));
  if (params?.sort) search.set("sort", params.sort);
  const query = search.toString();
  return apiFetch<PageResponse<InventoryReportLineResponse>>(
    `/api/v1/admin/orgs/${orgId}/inventory-report?${query}`,
    { token }
  );
}
