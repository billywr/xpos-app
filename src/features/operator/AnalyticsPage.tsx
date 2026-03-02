import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Clock,
  RefreshCw,
  Package,
  CreditCard,
  Loader2,
  HandCoins,
  ReceiptText,
  FileDown,
} from "lucide-react";
import { useState } from "react";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import {
  selectOrgId,
  selectBranchId,
  selectBranchName,
} from "@/store/selectors/orgContextSelectors";
import {
  fetchOperatorAnalyticsSnapshot,
  downloadBiReportPdf,
} from "@/api/operatorAnalytics";
import { formatCurrency } from "@/utils/formatCurrency";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";

const AUTO_REFRESH_MS = 5 * 60 * 1000;
const CHART_COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

function useAnalyticsSnapshot() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const branchId = useAppSelector(selectBranchId);

  return useQuery({
    queryKey: ["operator-analytics-snapshot", orgId, branchId],
    queryFn: () =>
      fetchOperatorAnalyticsSnapshot(token, orgId!, branchId!),
    enabled: Boolean(token && orgId && branchId),
    refetchInterval: AUTO_REFRESH_MS,
    refetchIntervalInBackground: true,
  });
}

export function AnalyticsPage() {
  const branchName = useAppSelector(selectBranchName);
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const branchId = useAppSelector(selectBranchId);
  const toast = useToast();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const {
    data: snapshot,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useAnalyticsSnapshot();

  if (!useAppSelector(selectOrgId) || !useAppSelector(selectBranchId)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <p className="text-slate-500 dark:text-slate-400">
          Select org and branch context to view analytics.
        </p>
      </div>
    );
  }

  if (isLoading && !snapshot) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30">
        <p className="font-medium text-red-800 dark:text-red-200">
          {getApiErrorMessage(error)}
        </p>
      </div>
    );
  }

  if (!snapshot) {
    return null;
  }

  const {
    summary,
    openShift,
    hourlyTrend,
    topItems,
    paymentBreakdown,
    last7DaysTrend,
    comparison,
    debtIntelligence,
    expenseIntelligence,
  } = snapshot;

  const handleDownloadBiPdf = async () => {
    if (!token || !orgId || !branchId) return;
    setDownloadingPdf(true);
    try {
      await downloadBiReportPdf(token, orgId, branchId);
      toast.success("BI report downloaded.", { title: "Report" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const hourlyChartData = hourlyTrend.map((p) => ({
    hour: `${p.hour}:00`,
    revenue: p.revenue,
    sales: p.count,
  }));

  const pieData = paymentBreakdown.map((p, i) => ({
    name: p.name,
    value: p.amount,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : "";

  return (
    <div className="min-h-0 flex-1 overflow-auto p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Analytics
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Real-time view for {branchName ?? "this branch"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Updated {lastUpdated} · Auto-refresh 5 mins
          </span>
          <button
            type="button"
            onClick={handleDownloadBiPdf}
            disabled={downloadingPdf}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            aria-label="Download BI report"
          >
            <FileDown
              className={`h-4 w-4 ${downloadingPdf ? "animate-spin" : ""}`}
            />
            BI Report (PDF)
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            aria-label="Refresh"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Today's revenue"
          value={summary.todayRevenue}
          icon={DollarSign}
          accent="primary"
        />
        <KpiCard
          title="Sales count"
          value={summary.todaySaleCount}
          icon={Receipt}
          accent="emerald"
        />
        <KpiCard
          title="Avg ticket"
          value={summary.todayAvgTicket}
          icon={Clock}
          accent="amber"
        />
        <ComparisonCard
          yesterdayRevenue={comparison.yesterdayRevenue}
          percentChange={comparison.percentChange}
          todayRevenue={summary.todayRevenue}
        />
      </div>

      {/* Debts & expenses intelligence */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Original debt"
          value={debtIntelligence?.totalOriginal ?? 0}
          icon={HandCoins}
          accent="amber"
        />
        <KpiCard
          title="Repaid"
          value={debtIntelligence?.totalRepaid ?? 0}
          icon={HandCoins}
          accent="emerald"
        />
        <KpiCard
          title="Outstanding"
          value={debtIntelligence?.totalOutstanding ?? 0}
          icon={HandCoins}
          accent="sky"
        />
        <KpiCard
          title="Payment rate"
          value={
            debtIntelligence?.paymentRatePercent != null
              ? `${debtIntelligence.paymentRatePercent}%`
              : "0%"
          }
          icon={HandCoins}
          accent="emerald"
        />
        <KpiCard
          title="Open / Settled"
          value={`${debtIntelligence?.openDebtCount ?? 0} / ${debtIntelligence?.settledDebtCount ?? 0}`}
          icon={HandCoins}
          accent="violet"
        />
        <KpiCard
          title="Overdue debt"
          value={debtIntelligence?.overdueAmount ?? 0}
          icon={HandCoins}
          accent="rose"
        />
        <KpiCard
          title="Today's expenses"
          value={expenseIntelligence?.todayTotal ?? 0}
          icon={ReceiptText}
          accent="primary"
        />
      </div>

      {/* Shift status */}
      {openShift.hasOpenShift && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
          <div className="flex items-center justify-between">
            <span className="font-medium text-emerald-800 dark:text-emerald-200">
              Shift open
            </span>
            {openShift.expectedCashInDrawer != null && (
              <span className="text-sm text-emerald-700 dark:text-emerald-300">
                Expected in drawer: {formatCurrency(openShift.expectedCashInDrawer)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">
            Hourly revenue
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyChartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-slate-200 dark:stroke-slate-600"
                />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10 }}
                  className="text-slate-600 dark:text-slate-400"
                />
                <YAxis
                  tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  formatter={(value: number | undefined) =>
                    [value != null ? formatCurrency(value) : "—", "Revenue"]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid rgb(203 213 225)",
                  }}
                />
                <Bar
                  dataKey="revenue"
                  fill="#0ea5e9"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">
            7-day trend
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last7DaysTrend}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-slate-200 dark:stroke-slate-600"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(d) =>
                    new Date(d).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })
                  }
                />
                <YAxis
                  tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  formatter={(value: number | undefined) =>
                    [value != null ? formatCurrency(value) : "—", "Revenue"]}
                  labelFormatter={(d) => new Date(d).toLocaleDateString()}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid rgb(203 213 225)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0ea5e9"
                  fill="url(#revenueGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom row: payment breakdown + top items */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <CreditCard className="h-5 w-5" />
            Payment mix
          </h2>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="h-48 w-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number | undefined) =>
                        value != null ? formatCurrency(value) : "—"}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid rgb(203 213 225)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1">
                {pieData.map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-slate-600 dark:text-slate-400">
                      {p.name}
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {formatCurrency(p.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-slate-500 dark:text-slate-400">
              No payments today
            </p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <Package className="h-5 w-5" />
            Top items
          </h2>
          {topItems.length > 0 ? (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {topItems.map((item) => (
                <div
                  key={item.itemId}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-700"
                >
                  <span className="truncate text-sm font-medium text-slate-900 dark:text-white">
                    {item.itemName}
                  </span>
                  <div className="flex shrink-0 gap-4 text-sm text-slate-600 dark:text-slate-400">
                    <span>×{item.totalQty}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {formatCurrency(item.totalRevenue)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-slate-500 dark:text-slate-400">
              No sales today
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  accent,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  accent: "primary" | "emerald" | "amber" | "sky" | "rose" | "violet";
}) {
  const bgClass =
    accent === "primary"
      ? "bg-primary-500"
      : accent === "emerald"
        ? "bg-emerald-500"
        : accent === "sky"
          ? "bg-sky-500"
          : accent === "rose"
            ? "bg-rose-500"
            : accent === "violet"
              ? "bg-violet-500"
              : "bg-amber-500";

  const displayValue =
    typeof value === "number"
      ? value % 1 !== 0
        ? formatCurrency(value)
        : value
      : value;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-600 dark:bg-slate-800">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {displayValue}
          </p>
        </div>
        <div className={`rounded-lg p-2.5 ${bgClass}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function ComparisonCard({
  yesterdayRevenue,
  percentChange,
}: {
  yesterdayRevenue: number;
  percentChange: number;
  todayRevenue: number;
}) {
  const isUp = percentChange >= 0;
  const Icon = isUp ? TrendingUp : TrendingDown;
  const colorClass = isUp
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-600 dark:bg-slate-800">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            vs yesterday
          </p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <span className={colorClass}>
              {percentChange > 0 ? "+" : ""}
              {percentChange.toFixed(1)}%
            </span>
            <Icon className={`h-6 w-6 ${colorClass}`} />
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Yesterday: {formatCurrency(yesterdayRevenue)}
          </p>
        </div>
      </div>
    </div>
  );
}
