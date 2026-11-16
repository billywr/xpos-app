import { apiFetch } from "@/api/client";

export interface ManualStockCountLineResponse {
  id: string;
  itemId: string | null;
  itemName: string;
  sku: string | null;
  openingQty: number;
  addedQty: number;
  addedTodayQty: number;
  totalStock: number;
  closingQty: number | null;
  systemQty: number | null;
  variance: number | null;
  unitsSold: number;
  sellingPrice: number;
  amount: number;
  comments: string | null;
  lineOrder: number;
}

export interface ManualStockCountSheetResponse {
  date: string;
  outletId: string;
  lastSavedAt: string | null;
  rows: ManualStockCountLineResponse[];
}

export interface ManualStockCountLineSaveRequest {
  itemId?: string | null;
  itemName: string;
  sku?: string | null;
  /** Omit or null to default opening from previous day's saved closing. */
  openingQty?: number | null;
  addedQty: number;
  addedTodayQty: number;
  closingQty?: number | null;
  systemQty?: number | null;
  sellingPrice: number;
  comments?: string | null;
  lineOrder?: number | null;
}

export interface ManualStockCountSaveRequest {
  date: string;
  outletId: string;
  rows: ManualStockCountLineSaveRequest[];
}

export async function fetchManualStockCountSheet(
  token: string | null,
  orgId: string,
  branchId: string,
  date: string
): Promise<ManualStockCountSheetResponse> {
  return apiFetch<ManualStockCountSheetResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/manual-stock-count?date=${encodeURIComponent(date)}`,
    { token }
  );
}

export async function saveManualStockCountSheet(
  token: string | null,
  orgId: string,
  branchId: string,
  body: ManualStockCountSaveRequest
): Promise<ManualStockCountSheetResponse> {
  return apiFetch<ManualStockCountSheetResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/manual-stock-count`,
    { method: "PUT", token, body }
  );
}
