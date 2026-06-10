import { apiFetch } from "@/api/client";

/**
 * One row in the Standard Stock Count Sheet. Backend provides opening, added columns, price, closing.
 * Opening is the latest saved closing before this date; 0 when no prior snapshot exists.
 * Added covers GRN receipts on this sheet date only.
 * Frontend computes totalStock, unitsSold, amount.
 */
export interface StdStockCountRowResponse {
  itemId: string;
  sku: string;
  name: string;
  /** Latest saved closing before this date; 0 when no prior snapshot exists. */
  openingStock: number;
  /** GRN receipts on this sheet date only (current line totals; includes edits). */
  addedStock: number;
  /** Stock-take adjustments today (not GRN). Included in Total Stock; no separate table column. */
  addedTodayStock: number;
  sellingPrice: number;
  closingStock: number | null;
  lastSavedAt: string | null;
  /** Saved notes for this count line (optional). */
  comments: string | null;
}

export interface StdStockCountSheetResponse {
  date: string;
  outletId: string;
  rows: StdStockCountRowResponse[];
}

export interface StdStockCountCountRequest {
  itemId: string;
  closingStock: number;
  /** Sent on every save; updates snapshot when provided. */
  comments?: string | null;
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

export type StdStockCountSalesLineStatus =
  | "RECORDED"
  | "SKIPPED_NO_QTY"
  | "SKIPPED_NO_CLOSING"
  | "SKIPPED_NO_IMPLIED_SALE"
  | "WARNING_OVER_RECORDED";

export interface StdStockCountSalesLineResponse {
  itemId: string;
  name: string;
  impliedSold: number;
  alreadyRecorded: number;
  qtyToRecord: number;
  qtyRecorded: number | null;
  unitPrice: number;
  lineValue: number;
  status: StdStockCountSalesLineStatus | null;
}

export interface StdStockCountSalesPreviewResponse {
  date: string;
  branchId: string;
  lines: StdStockCountSalesLineResponse[];
  totalQtyToRecord: number;
  totalValueToRecord: number;
}

export interface StdStockCountRecordSalesRequest {
  date: string;
  terminalId: string;
}

export interface StdStockCountRecordSalesResponse {
  date: string;
  terminalId: string;
  totalItemsRecorded: number;
  totalValue: number;
  saleIds: string[];
  lines: StdStockCountSalesLineResponse[];
}

export async function fetchStdStockCountSalesPreview(
  token: string | null,
  orgId: string,
  branchId: string,
  date: string
): Promise<StdStockCountSalesPreviewResponse> {
  return apiFetch<StdStockCountSalesPreviewResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/std-stock-count/sales-preview?date=${encodeURIComponent(date)}`,
    { token }
  );
}

export async function recordStdStockCountSales(
  token: string | null,
  orgId: string,
  branchId: string,
  body: StdStockCountRecordSalesRequest
): Promise<StdStockCountRecordSalesResponse> {
  return apiFetch<StdStockCountRecordSalesResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/std-stock-count/record-sales`,
    { token, method: "POST", body }
  );
}

export interface StdStockCountReconcileLineResponse {
  itemId: string;
  name: string;
  closingStock: number;
  onHandQty: number;
  variance: number;
}

export interface StdStockCountReconcilePreviewResponse {
  date: string;
  branchId: string;
  lines: StdStockCountReconcileLineResponse[];
  itemsAdjusted: number;
  itemsAlreadyMatched: number;
}

export interface StdStockCountReconcileRequest {
  date: string;
  outletId: string;
}

export interface StdStockCountReconcileResponse {
  date: string;
  branchId: string;
  lines: StdStockCountReconcileLineResponse[];
  adjustedCount: number;
  itemsAlreadyMatched: number;
}

export async function fetchStdStockCountReconcilePreview(
  token: string | null,
  orgId: string,
  branchId: string,
  date: string
): Promise<StdStockCountReconcilePreviewResponse> {
  return apiFetch<StdStockCountReconcilePreviewResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/std-stock-count/reconcile-preview?date=${encodeURIComponent(date)}`,
    { token }
  );
}

export async function reconcileStdStockCountInventory(
  token: string | null,
  orgId: string,
  branchId: string,
  body: StdStockCountReconcileRequest
): Promise<StdStockCountReconcileResponse> {
  return apiFetch<StdStockCountReconcileResponse>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/std-stock-count/reconcile-inventory`,
    { token, method: "POST", body }
  );
}
