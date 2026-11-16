import { getDatabase } from "@/db/database";

export interface RevenueSummaryResponse {
  orgId: string;
  branchId: string;
  startDate: string;
  endDate: string;
  revenueTotal: number;
  taxTotal: number;
  discountTotal: number;
  cogsTotal: number;
  expenseTotal?: number;
  netProfit?: number;
  saleCount: number;
}

export interface RevenueTrendPointResponse {
  date: string;
  revenue: number;
  tax: number;
  cogs: number;
  expenses?: number;
  netProfit?: number;
  saleCount: number;
}

export interface RevenueDashboardResponse {
  summary: RevenueSummaryResponse;
  trend: RevenueTrendPointResponse[];
}

export async function fetchRevenueDashboard(
  _token: string | null,
  _orgId: string,
  _branchId: string,
  startDate: string,
  endDate: string
): Promise<RevenueDashboardResponse> {
  const db = await getDatabase();

  // Aggregate Sales
  const salesSummary = await db.getFirstAsync<any>(
    `SELECT 
      COALESCE(SUM(total), 0) as revenueTotal,
      COALESCE(SUM(tax_total), 0) as taxTotal,
      COALESCE(SUM(cogs_total), 0) as cogsTotal,
      COUNT(*) as saleCount
     FROM sales 
     WHERE sale_date BETWEEN ? AND ? AND status = 'COMPLETED'`,
    [startDate, endDate]
  );

  // Aggregate Expenses
  const expSummary = await db.getFirstAsync<any>(
    `SELECT COALESCE(SUM(amount), 0) as expenseTotal
     FROM misc_expenses
     WHERE date(created_at) BETWEEN ? AND ?`,
    [startDate, endDate]
  );

  const revenueTotal = Number(salesSummary?.revenueTotal ?? 0);
  const taxTotal = Number(salesSummary?.taxTotal ?? 0);
  const cogsTotal = Number(salesSummary?.cogsTotal ?? 0);
  const expenseTotal = Number(expSummary?.expenseTotal ?? 0);
  const netProfit = revenueTotal - cogsTotal - expenseTotal;
  const saleCount = Number(salesSummary?.saleCount ?? 0);

  // Fetch daily sales breakdown
  const salesByDate = await db.getAllAsync<any>(
    `SELECT 
      sale_date as date,
      SUM(total) as revenue,
      SUM(tax_total) as tax,
      SUM(cogs_total) as cogs,
      COUNT(*) as saleCount
     FROM sales
     WHERE sale_date BETWEEN ? AND ? AND status = 'COMPLETED'
     GROUP BY sale_date
     ORDER BY sale_date ASC`,
    [startDate, endDate]
  );

  // Fetch daily expenses breakdown
  const expByDate = await db.getAllAsync<any>(
    `SELECT 
      date(created_at) as date,
      SUM(amount) as expenses
     FROM misc_expenses
     WHERE date(created_at) BETWEEN ? AND ?
     GROUP BY date(created_at)
     ORDER BY date(created_at) ASC`,
    [startDate, endDate]
  );

  const salesMap = new Map<string, any>();
  for (const s of salesByDate) {
    salesMap.set(s.date, s);
  }

  const expMap = new Map<string, number>();
  for (const e of expByDate) {
    expMap.set(e.date, Number(e.expenses ?? 0));
  }

  // Collect all unique dates
  const allDates = new Set<string>();
  salesMap.forEach((_, d) => allDates.add(d));
  expMap.forEach((_, d) => allDates.add(d));

  // If start and end date range has no sales/expenses, include at least startDate
  if (allDates.size === 0) {
    allDates.add(startDate);
  }

  const sortedDates = Array.from(allDates).sort();

  const trend: RevenueTrendPointResponse[] = sortedDates.map((dateStr) => {
    const s = salesMap.get(dateStr);
    const rev = Number(s?.revenue ?? 0);
    const tax = Number(s?.tax ?? 0);
    const cogs = Number(s?.cogs ?? 0);
    const exp = Number(expMap.get(dateStr) ?? 0);
    const dayNetProfit = rev - cogs - exp;
    const count = Number(s?.saleCount ?? 0);

    return {
      date: dateStr,
      revenue: rev,
      tax,
      cogs,
      expenses: exp,
      netProfit: dayNetProfit,
      saleCount: count,
    };
  });

  return {
    summary: {
      orgId: "offline-org",
      branchId: "offline-branch",
      startDate,
      endDate,
      revenueTotal,
      taxTotal,
      discountTotal: 0,
      cogsTotal,
      expenseTotal,
      netProfit,
      saleCount,
    },
    trend,
  };
}
