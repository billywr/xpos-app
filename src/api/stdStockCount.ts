import { apiFetch } from "@/api/client";

/**
 * One row in the Standard Stock Count Sheet. Backend provides opening, added columns, price, closing.
 * Opening is previous business day's saved closing when present; else max(0, system − same-day adds).
 * Frontend computes totalStock, unitsSold, amount.
 */
export interface StdStockCountRowResponse {
  itemId: string;
  sku: string;
  name: string;
  /** Yesterday's saved closing, or ledger fallback when no snapshot. */
  openingStock: number;
  /** Qty on active GRNs with receivedAt on this sheet date (current line totals; includes edits). */
  addedStock: number;
  /** Stock-take adjustments today (not GRN). Included in Total Stock; no separate table column. */
  addedTodayStock: number;
  /** Ledger on-hand at end of selected day (from movements; not live stock for a past date). */
  systemCountBeforeToday: number;
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
