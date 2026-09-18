import { apiFetch } from "./client";
import type {
  StdStockCountSheetResponse,
  StdStockCountSaveRequest,
  StdStockCountSalesPreviewResponse,
  StdStockCountReconcilePreviewResponse,
} from "@/types";

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
  body: { date: string; terminalId: string }
): Promise<any> {
  return apiFetch(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/std-stock-count/record-sales`,
    { token, method: "POST", body }
  );
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
  body: { date: string; outletId: string }
): Promise<any> {
  return apiFetch(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/std-stock-count/reconcile-inventory`,
    { token, method: "POST", body }
  );
}
