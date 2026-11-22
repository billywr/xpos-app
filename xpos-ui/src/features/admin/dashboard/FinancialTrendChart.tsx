import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { RevenueTrendPointResponse } from "@/api/revenueDashboard";
import { formatAmount, formatPercent } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import { DASHBOARD_CARD_STATIC_3D } from "./dashboardStyles";
import { TrendingUp, AlertCircle } from "lucide-react";

interface FinancialTrendChartProps {
  trend: RevenueTrendPointResponse[];
  isLoading: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const rev = payload.find((p) => p.name === "Revenue")?.value ?? 0;
  const cost = payload.find((p) => p.name === "Total cost")?.value ?? 0;
  const profit = payload.find((p) => p.name === "Net profit")?.value ?? 0;
  const margin = rev > 0 ? (profit / rev) * 100 : 0;

  return (
    <div className="z-50 rounded-lg border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      <p className="border-b border-slate-100 pb-1.5 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200">
        {label}
      </p>
      <div className="mt-2 space-y-1 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
            <span className="h-2 w-2 rounded-full bg-sky-600 dark:bg-sky-400" />
            Revenue:
          </span>
          <span className="font-semibold text-slate-800 dark:text-white">
            KSh {formatAmount(rev)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Total cost:
          </span>
          <span className="font-semibold text-slate-800 dark:text-white">
            KSh {formatAmount(cost)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className={`flex items-center gap-1.5 ${profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            <span className={`h-2 w-2 rounded-full ${profit >= 0 ? "bg-emerald-500" : "bg-rose-500"}`} />
            Net profit:
          </span>
          <span className={`font-bold ${profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            KSh {formatAmount(profit)}
          </span>
        </div>

        <div className="border-t border-slate-100 pt-1 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Net margin: <strong className="text-slate-700 dark:text-slate-300">{formatPercent(margin)}</strong>
        </div>
      </div>
    </div>
  );
}

export function FinancialTrendChart({ trend, isLoading }: FinancialTrendChartProps) {
  const chartData = useMemo(() => {
    return trend.map((point) => {
      const cogs = point.cogs || 0;
      const expenses = point.expenses || 0;
      const utilities = point.utilities || 0;
      const totalCost = cogs + expenses + utilities;
      const revenue = point.revenue || 0;
      const netProfit = point.netProfit ?? (revenue - totalCost);

      return {
        rawDate: point.date,
        formattedDate: formatDate(point.date),
        Revenue: revenue,
        "Total cost": totalCost,
        "Net profit": netProfit,
        saleCount: point.saleCount,
      };
    });
  }, [trend]);

  return (
    <div className={DASHBOARD_CARD_STATIC_3D}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-700/60">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-sky-100 p-2 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">
              Financial trajectory & profitability
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Daily revenue, overall cost, and net profit evolution
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-600 dark:bg-sky-400" />
            <span className="text-slate-600 dark:text-slate-300">Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="text-slate-600 dark:text-slate-300">Total costs</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-600 dark:text-slate-300">Net profit</span>
          </div>
        </div>
      </div>

      <div className="mt-4 h-[300px] w-full">
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary-500 dark:border-slate-700" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <AlertCircle className="h-8 w-8 stroke-[1.5]" />
            <p className="mt-2 text-sm">No transaction or profit data in selected date range</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(148, 163, 184, 0.15)"
                vertical={false}
              />
              <XAxis
                dataKey="formattedDate"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={{ stroke: "rgba(148, 163, 184, 0.2)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => formatAmount(val)}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={0}
                stroke="#ef4444"
                strokeDasharray="3 3"
                strokeOpacity={0.6}
              />
              <Line
                type="monotone"
                dataKey="Revenue"
                stroke="#0284c7"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: "#0284c7", strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="Total cost"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                activeDot={{ r: 4, fill: "#f59e0b", strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="Net profit"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: "#10b981", strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
