import { apiFetch } from "@/api/client";

export interface SalesRecordingEntry {
  itemId: string;
  qty: number;
}

export interface SalesRecordingRequestBody {
  saleDate: string;
  entries: SalesRecordingEntry[];
}

export interface SalesRecordingResponse {
  saleDate: string;
  createdSaleIds: string[];
  totalValue: number;
  totalItemsSold: number;
}

export interface TopSellingItem {
  itemId: string;
  itemName: string;
  qtySold: number;
  totalValue: number;
}

export interface LowStockItem {
  itemId: string;
  itemName: string;
  onHandQty: number;
}

export interface ItemSoldQty {
  itemId: string;
  qtySold: number;
  totalValue: number;
}

export interface SalesRecordingStatsResponse {
  saleDate: string;
  totalSalesValue: number;
  totalItemsSold: number;
  saleCount: number;
  topSellingItems: TopSellingItem[];
  lowStockItems: LowStockItem[];
  soldByItem: ItemSoldQty[];
}

function basePath(orgId: string, branchId: string, terminalId: string): string {
  return `/api/v1/operator/orgs/${orgId}/branches/${branchId}/terminals/${terminalId}/sales-recording`;
}

export async function recordHistoricalSales(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  body: SalesRecordingRequestBody
): Promise<SalesRecordingResponse> {
  return apiFetch<SalesRecordingResponse>(basePath(orgId, branchId, terminalId), {
    token,
    method: "POST",
    body,
  });
}

export async function fetchSalesRecordingStats(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  date: string
): Promise<SalesRecordingStatsResponse> {
  const params = new URLSearchParams({ date });
  return apiFetch<SalesRecordingStatsResponse>(
    `${basePath(orgId, branchId, terminalId)}/stats?${params.toString()}`,
    { token }
  );
}
