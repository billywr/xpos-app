import { apiFetch } from "@/api/client";

/**
 * One row in the Standard Stock Count Sheet. Backend provides opening, added, price, closing.
 * Frontend computes totalStock, unitsSold, amount.
 */
export interface StdStockCountRowResponse {
  itemId: string;
  sku: string;
  name: string;
  openingStock: number;
  addedStock: number;
  systemCountBeforeToday: number;
  sellingPrice: number;
  closingStock: number | null;
  lastSavedAt: string | null;
}

export interface StdStockCountSheetResponse {
  date: string;
  outletId: string;
  rows: StdStockCountRowResponse[];
}

export interface StdStockCountCountRequest {
  itemId: string;
  closingStock: number;
}

export interface StdStockCountSaveRequest {
  date: string;
  outletId: string;
  counts: StdStockCountCountRequest[];
}

export async function fetchStdStockCountSheet(
  token: string | null,
  orgId: string,
  branchId: string,
  date: string
): Promise<StdStockCountSheetResponse> {
  return apiFetch<StdStockCountSheetResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/std-stock-count?date=${encodeURIComponent(date)}`,
    { token }
  );
}

export async function saveStdStockCount(
  token: string | null,
  orgId: string,
  branchId: string,
  body: StdStockCountSaveRequest
): Promise<StdStockCountSheetResponse> {
  return apiFetch<StdStockCountSheetResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/std-stock-count`,
    { token, method: "PUT", body }
  );
}
