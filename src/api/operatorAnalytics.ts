import { apiFetch, getApiBaseUrl } from "@/api/client";

export interface AnalyticsSummary {
  todayRevenue: number;
  todaySaleCount: number;
  todayAvgTicket: number;
  todayTaxTotal: number;
}

export interface AnalyticsOpenShift {
  hasOpenShift: boolean;
  expectedCashInDrawer: number | null;
  latestOpenedAt: string | null;
}

export interface AnalyticsHourlyPoint {
  hour: number;
  revenue: number;
  count: number;
}

export interface AnalyticsTopItem {
  itemId: string;
  itemName: string;
  totalQty: number;
  totalRevenue: number;
}

export interface AnalyticsPaymentBreakdown {
  code: string;
  name: string;
  amount: number;
}

export interface AnalyticsDailyTrendPoint {
  date: string;
  revenue: number;
  saleCount: number;
}

export interface AnalyticsComparison {
  previousPeriodRevenue: number;
  percentChange: number;
}

export interface DebtIntelligence {
  totalOriginal: number;
  totalRepaid: number;
  totalOutstanding: number;
  paymentRatePercent: number;
  overdueAmount: number;
  openDebtCount: number;
  settledDebtCount: number;
}

export interface ExpenseByCategory {
  category: string;
  amount: number;
}

export interface ExpenseIntelligence {
  todayTotal: number;
  byCategory: ExpenseByCategory[];
}

export interface AnalyticsSnapshotResponse {
  businessDate: string;
  fromDate: string;
  toDate: string;
  timezone: string;
  summary: AnalyticsSummary;
  openShift: AnalyticsOpenShift;
  hourlyTrend: AnalyticsHourlyPoint[];
  topItems: AnalyticsTopItem[];
  paymentBreakdown: AnalyticsPaymentBreakdown[];
  last7DaysTrend: AnalyticsDailyTrendPoint[];
  comparison: AnalyticsComparison;
  debtIntelligence: DebtIntelligence;
  expenseIntelligence: ExpenseIntelligence;
  fetchedAt: string;
}

export async function fetchOperatorAnalyticsSnapshot(
  token: string | null,
  orgId: string,
  branchId: string,
  fromDate?: string,
  toDate?: string
): Promise<AnalyticsSnapshotResponse> {
  const params = new URLSearchParams();
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  const qs = params.toString();
  const url = `/api/v1/operator/orgs/${orgId}/branches/${branchId}/analytics/snapshot${qs ? `?${qs}` : ""}`;
  return apiFetch<AnalyticsSnapshotResponse>(url, { token });
}

/**
 * Downloads the BI PDF report. Fetches with auth, then triggers browser download.
 */
export async function downloadBiReportPdf(
  token: string | null,
  orgId: string,
  branchId: string,
  fromDate?: string,
  toDate?: string
): Promise<void> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams();
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  const qs = params.toString();
  const url = `${base}/api/v1/operator/orgs/${orgId}/branches/${branchId}/reports/bi-pdf${qs ? `?${qs}` : ""}`;
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Download failed: ${res.status}`);
  }
  const blob = await res.blob();
  const contentDisposition = res.headers.get("Content-Disposition");
  const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/);
  const filename = filenameMatch?.[1] ?? "xpos-bi-report.pdf";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
