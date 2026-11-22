import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCw, Calendar, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { selectOrgId, selectBranchId } from "@/store/selectors/orgContextSelectors";
import { fetchRevenueDashboard } from "@/api/revenueDashboard";
import { fetchInventoryReport } from "@/api/inventoryReport";
import { fetchItems } from "@/api/items";
import { fetchOperatorAnalyticsSnapshot } from "@/api/operatorAnalytics";
import { fetchMiscExpenses } from "@/api/miscExpenses";
import { fetchRecurringUtilities } from "@/api/recurringUtilities";
import { AnalyticsOrgBranchFilter } from "@/components/AnalyticsOrgBranchFilter";
import { DateInput } from "@/components/ui/DateInput";
import { getApiErrorMessage } from "@/utils/apiError";
import { cn } from "@/utils/cn";
import { useToast } from "@/contexts/ToastContext";
import { DashboardKpiCards } from "./dashboard/DashboardKpiCards";
import { FinancialTrendChart } from "./dashboard/FinancialTrendChart";
import { CostStructureChart } from "./dashboard/CostStructureChart";
import { StockHealthSection } from "./dashboard/StockHealthSection";
import { TopProductsList } from "./dashboard/TopProductsList";
import { CostBreakdownSlideOver } from "./dashboard/CostBreakdownSlideOver";

type PresetRange =
  | "today"
  | "thisWeek"
  | "lastWeek"
  | "7days"
  | "thisMonth"
  | "lastMonth"
  | "30days"
  | "year"
  | "all"
  | "custom";

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getRangeDates(preset: PresetRange): { start: string; end: string } {
  const now = new Date();
  const today = formatLocalDate(now);

  if (preset === "today") {
    return { start: today, end: today };
  }

  const dayOfWeek = now.getDay();
  const diffToMonday = (dayOfWeek + 6) % 7;
  const thisWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);

  if (preset === "thisWeek") {
    return { start: formatLocalDate(thisWeekStart), end: today };
  }
  if (preset === "lastWeek") {
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
    return { start: formatLocalDate(lastWeekStart), end: formatLocalDate(lastWeekEnd) };
  }
  if (preset === "7days") {
    const s = new Date(now);
    s.setDate(s.getDate() - 6);
    return { start: formatLocalDate(s), end: today };
  }
  if (preset === "thisMonth") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: formatLocalDate(s), end: today };
  }
  if (preset === "lastMonth") {
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: formatLocalDate(lastMonthStart), end: formatLocalDate(lastMonthEnd) };
  }
  if (preset === "30days") {
    const s = new Date(now);
    s.setDate(s.getDate() - 29);
    return { start: formatLocalDate(s), end: today };
  }
  if (preset === "year") {
    const curYear = now.getFullYear();
    return { start: `${curYear}-01-01`, end: today };
  }
  if (preset === "all") {
    return { start: "2020-01-01", end: today };
  }
  return { start: today, end: today };
}

export function AdminDashboard() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const branchId = useAppSelector(selectBranchId);

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [isCostBreakdownOpen, setIsCostBreakdownOpen] = useState(false);

  const [activePreset, setActivePreset] = useState<PresetRange>("30days");
  const initialDates = useMemo(() => getRangeDates("30days"), []);
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);

  const handlePresetChange = (preset: PresetRange) => {
    setActivePreset(preset);
    if (preset !== "custom") {
      const { start, end } = getRangeDates(preset);
      setStartDate(start);
      setEndDate(end);
    }
  };

  const handlePrevYear = () => {
    const targetYear = (activePreset === "year" ? selectedYear : currentYear) - 1;
    setSelectedYear(targetYear);
    setActivePreset("year");
    setStartDate(`${targetYear}-01-01`);
    setEndDate(`${targetYear}-12-31`);
  };

  const handleNextYear = () => {
    if (selectedYear >= currentYear) return;
    const targetYear = selectedYear + 1;
    setSelectedYear(targetYear);
    setActivePreset("year");
    setStartDate(`${targetYear}-01-01`);
    const today = formatLocalDate(new Date());
    setEndDate(targetYear === currentYear ? today : `${targetYear}-12-31`);
  };

  const handleSelectYearPreset = () => {
    setActivePreset("year");
    setStartDate(`${selectedYear}-01-01`);
    const today = formatLocalDate(new Date());
    setEndDate(selectedYear === currentYear ? today : `${selectedYear}-12-31`);
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setActivePreset("custom");
    setStartDate(val);
    if (val > endDate) {
      setEndDate(val);
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setActivePreset("custom");
    setEndDate(val);
    if (val < startDate) {
      setStartDate(val);
    }
  };

  const isEnabled = Boolean(token && orgId && branchId);

  // 1. Revenue & Profit/Loss Dashboard
  const {
    data: revenueData,
    isLoading: isRevenueLoading,
    isFetching: isRevenueFetching,
    error: revenueError,
    refetch: refetchRevenue,
  } = useQuery({
    queryKey: ["admin-revenue-dashboard", orgId, branchId, startDate, endDate],
    queryFn: () => fetchRevenueDashboard(token, orgId!, branchId!, startDate, endDate),
    enabled: isEnabled,
    staleTime: 60 * 1000,
  });

  // 2. Inventory Stock Levels Report
  const {
    data: inventoryData,
    isLoading: isInventoryLoading,
    isFetching: isInventoryFetching,
    error: inventoryError,
    refetch: refetchInventory,
  } = useQuery({
    queryKey: ["admin-inventory-report", orgId, branchId],
    queryFn: () => fetchInventoryReport(token, orgId!, branchId!, { size: 100 }),
    enabled: isEnabled,
    staleTime: 60 * 1000,
  });

  // 3. Catalog Items (for item purchase/buying prices to compute asset valuation)
  const {
    data: itemsData,
    isLoading: isItemsLoading,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ["admin-dashboard-items", orgId],
    queryFn: () => fetchItems(token, orgId!, { size: 200 }),
    enabled: Boolean(token && orgId),
    staleTime: 5 * 60 * 1000,
  });

  // 4. Operator Analytics Snapshot (for top products ranking)
  const {
    data: snapshotData,
    isLoading: isSnapshotLoading,
    isFetching: isSnapshotFetching,
    refetch: refetchSnapshot,
  } = useQuery({
    queryKey: ["admin-dashboard-snapshot", orgId, branchId, startDate, endDate],
    queryFn: () => fetchOperatorAnalyticsSnapshot(token, orgId!, branchId!, startDate, endDate),
    enabled: isEnabled,
    staleTime: 60 * 1000,
  });

  // 5. Operating Expenses
  const {
    data: expensesData,
    isLoading: isExpensesLoading,
    isFetching: isExpensesFetching,
    refetch: refetchExpenses,
  } = useQuery({
    queryKey: ["admin-dashboard-expenses", orgId, branchId, startDate, endDate],
    queryFn: () =>
      fetchMiscExpenses(token, orgId!, branchId!, {
        fromDate: startDate,
        toDate: endDate,
        size: 500,
      }),
    enabled: isEnabled,
    staleTime: 60 * 1000,
  });

  // 6. Recurring Utilities
  const {
    data: utilitiesData,
    isLoading: isUtilitiesLoading,
    isFetching: isUtilitiesFetching,
    refetch: refetchUtilities,
  } = useQuery({
    queryKey: ["admin-dashboard-utilities", orgId, branchId, startDate, endDate],
    queryFn: () =>
      fetchRecurringUtilities(token, orgId!, branchId!, {
        startDate,
        endDate,
        size: 200,
      }),
    enabled: isEnabled,
    staleTime: 60 * 1000,
  });

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const toast = useToast();

  const isRefreshing =
    isManualRefreshing ||
    isRevenueFetching ||
    isInventoryFetching ||
    isSnapshotFetching ||
    isExpensesFetching ||
    isUtilitiesFetching;
  const isLoading = isRevenueLoading || isInventoryLoading || isItemsLoading;

  const handleRefreshAll = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await Promise.all([
        refetchRevenue(),
        refetchInventory(),
        refetchItems(),
        refetchSnapshot(),
        refetchExpenses(),
        refetchUtilities(),
      ]);
      toast.success("Dashboard refreshed");
    } catch {
      toast.error("Failed to refresh dashboard");
    } finally {
      setIsManualRefreshing(false);
    }
  }, [refetchRevenue, refetchInventory, refetchItems, refetchSnapshot, refetchExpenses, refetchUtilities, toast]);

  // Inventory valuation & health calculation
  const {
    totalStockValue,
    lowStockCount,
    outOfStockCount,
    healthyStockCount,
    totalTrackedItems,
  } = useMemo(() => {
    const itemMap = new Map(
      (itemsData?.content ?? []).map((item) => [
        item.id,
        item.buyingPrice ?? item.defaultSellingPrice ?? 0,
      ])
    );

    let val = 0;
    let low = 0;
    let out = 0;
    let healthy = 0;
    let tracked = 0;

    const lines = inventoryData?.content ?? [];
    for (const line of lines) {
      if (!line.trackInventory) continue;
      tracked++;
      const price = itemMap.get(line.itemId) ?? 0;
      if (line.onHandQty > 0) {
        val += line.onHandQty * price;
      }
      if (line.onHandQty <= 0) {
        out++;
      } else if (line.onHandQty <= 10) {
        low++;
      } else {
        healthy++;
      }
    }

    return {
      totalStockValue: val,
      lowStockCount: low,
      outOfStockCount: out,
      healthyStockCount: healthy,
      totalTrackedItems: tracked,
    };
  }, [inventoryData?.content, itemsData?.content]);

  // Financial summary numbers
  const summary = revenueData?.summary;
  const revenueTotal = summary?.revenueTotal ?? 0;
  const saleCount = summary?.saleCount ?? 0;
  const cogsTotal = summary?.cogsTotal ?? 0;
  const expenseTotal = summary?.expenseTotal ?? 0;
  const utilitiesTotal = summary?.utilitiesTotal ?? 0;
  const netProfit =
    summary?.netProfit ?? (revenueTotal - cogsTotal - expenseTotal - utilitiesTotal);

  const trend = revenueData?.trend ?? [];
  const topItems = snapshotData?.topItems ?? [];
  const inventoryItems = inventoryData?.content ?? [];

  const anyError = revenueError || inventoryError;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Context Control Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Executive dashboard
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <AnalyticsOrgBranchFilter />
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            title="Refresh dashboard data"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Date Range & Period Selection Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm dark:border-slate-700/80 dark:bg-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Period:
          </span>
          {(
            [
              { key: "all", label: "All" },
              { key: "today", label: "Today" },
              { key: "thisWeek", label: "This week" },
              { key: "lastWeek", label: "Last week" },
              { key: "7days", label: "Last 7 days" },
              { key: "thisMonth", label: "This month" },
              { key: "lastMonth", label: "Last month" },
              { key: "30days", label: "Last 30 days" },
            ] as const
          ).map(({ key, label }) => {
            const isActive = activePreset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handlePresetChange(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-primary-600 text-white shadow-sm dark:bg-primary-500"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/60"
                }`}
              >
                {label}
              </button>
            );
          })}

          {/* Year navigator stepper (< This year >) */}
          <div
            className={cn(
              "inline-flex h-7 w-[132px] shrink-0 items-center justify-between rounded-lg border overflow-hidden transition-colors",
              activePreset === "year"
                ? "border-primary-600 bg-primary-600 text-white shadow-sm dark:border-primary-500 dark:bg-primary-500"
                : "border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            )}
          >
            <button
              type="button"
              onClick={handlePrevYear}
              title="Previous year"
              aria-label="Previous year"
              className={cn(
                "flex h-7 w-6 shrink-0 items-center justify-center transition-colors",
                activePreset === "year"
                  ? "bg-black/25 text-white hover:bg-black/40 active:bg-black/50 border-r border-black/15 dark:bg-black/35 dark:hover:bg-black/50 dark:border-white/20"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border-r border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-white dark:border-slate-600"
              )}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleSelectYearPreset}
              className={cn(
                "flex-1 h-7 min-w-0 px-1 text-center text-xs font-semibold whitespace-nowrap transition-colors flex items-center justify-center",
                activePreset === "year"
                  ? "hover:bg-black/10 dark:hover:bg-white/10"
                  : "hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-slate-700/50 dark:hover:text-white"
              )}
            >
              {selectedYear === currentYear ? "This year" : selectedYear}
            </button>
            <button
              type="button"
              onClick={handleNextYear}
              disabled={selectedYear >= currentYear}
              title={selectedYear < currentYear ? "Next year" : undefined}
              aria-label="Next year"
              className={cn(
                "flex h-7 w-6 shrink-0 items-center justify-center transition-colors",
                activePreset === "year"
                  ? "bg-black/25 text-white hover:bg-black/40 active:bg-black/50 border-l border-black/15 dark:bg-black/35 dark:hover:bg-black/50 dark:border-white/20"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border-l border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-white dark:border-slate-600",
                selectedYear >= currentYear && "opacity-25 pointer-events-none"
              )}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Date Inputs */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <DateInput
            value={startDate}
            onChange={handleStartDateChange}
            aria-label="Start date"
            className="w-32 text-xs"
          />
          <span className="text-xs text-slate-400">to</span>
          <DateInput
            value={endDate}
            onChange={handleEndDateChange}
            aria-label="End date"
            className="w-32 text-xs"
          />
        </div>
      </div>

      {/* Error Alert (if any query failed) */}
      {anyError && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            <span>
              Failed to load some dashboard metrics: {getApiErrorMessage(anyError)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => refetchRevenue()}
            className="font-semibold underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* 1. Executive Business Position & Profitability KPI Cards */}
      <DashboardKpiCards
        isLoading={isLoading}
        revenueTotal={revenueTotal}
        saleCount={saleCount}
        cogsTotal={cogsTotal}
        expenseTotal={expenseTotal}
        utilitiesTotal={utilitiesTotal}
        netProfit={netProfit}
        totalStockValue={totalStockValue}
        totalTrackedItems={totalTrackedItems}
        lowStockCount={lowStockCount}
        outOfStockCount={outOfStockCount}
        onOpenCostBreakdown={() => setIsCostBreakdownOpen(true)}
      />

      {/* 2. Visual Charts Row: Financial Trend (2 cols) + Cost Structure (1 col) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FinancialTrendChart trend={trend} isLoading={isRevenueLoading} />
        </div>
        <div className="lg:col-span-1">
          <CostStructureChart
            cogsTotal={cogsTotal}
            expenseTotal={expenseTotal}
            utilitiesTotal={utilitiesTotal}
            isLoading={isRevenueLoading}
          />
        </div>
      </div>

      {/* 3. Operational Row: Stock Health & Watchlist (2 cols) + Top Products (1 col) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <StockHealthSection
            inventoryItems={inventoryItems}
            isLoading={isInventoryLoading}
            lowStockCount={lowStockCount}
            outOfStockCount={outOfStockCount}
            healthyStockCount={healthyStockCount}
          />
        </div>
        <div className="lg:col-span-1">
          <TopProductsList
            topItems={topItems}
            isLoading={isSnapshotLoading}
          />
        </div>
      </div>

      {/* 4. Cost & Expense Breakdown Slide-Over Sheet */}
      <CostBreakdownSlideOver
        open={isCostBreakdownOpen}
        onClose={() => setIsCostBreakdownOpen(false)}
        startDate={startDate}
        endDate={endDate}
        expenseTotal={expenseTotal}
        utilitiesTotal={utilitiesTotal}
        expenses={expensesData?.content ?? []}
        utilities={utilitiesData?.items ?? []}
        isLoading={isExpensesLoading || isUtilitiesLoading}
      />
    </div>
  );
}
