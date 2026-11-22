import { TrendingUp, TrendingDown, Receipt, PieChart as PieChartIcon, Boxes } from "lucide-react";
import { formatAmount, formatPercent } from "@/utils/formatCurrency";
import { DASHBOARD_CARD_3D } from "./dashboardStyles";

interface DashboardKpiCardsProps {
  isLoading: boolean;
  revenueTotal: number;
  saleCount: number;
  cogsTotal: number;
  expenseTotal: number;
  utilitiesTotal: number;
  netProfit: number;
  totalStockValue: number;
  totalTrackedItems: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export function DashboardKpiCards({
  isLoading,
  revenueTotal,
  saleCount,
  cogsTotal,
  expenseTotal,
  utilitiesTotal,
  netProfit,
  totalStockValue,
  totalTrackedItems,
  lowStockCount,
  outOfStockCount,
}: DashboardKpiCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`${DASHBOARD_CARD_3D} animate-pulse h-36`} />
        ))}
      </div>
    );
  }

  const isProfitable = netProfit > 0;
  const isLoss = netProfit < 0;
  const netMargin = revenueTotal > 0 ? (netProfit / revenueTotal) * 100 : 0;
  const avgTicket = saleCount > 0 ? revenueTotal / saleCount : 0;
  const totalCost = cogsTotal + expenseTotal + utilitiesTotal;
  const grossProfit = revenueTotal - cogsTotal;
  const grossMargin = revenueTotal > 0 ? (grossProfit / revenueTotal) * 100 : 0;
  const criticalStockCount = lowStockCount + outOfStockCount;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Net profit & business position */}
      <div className={DASHBOARD_CARD_3D}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Net profit / loss
          </span>
          <div
            className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isProfitable
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                : isLoss
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
            }`}
          >
            {isProfitable ? (
              <TrendingUp className="h-3 w-3" />
            ) : isLoss ? (
              <TrendingDown className="h-3 w-3" />
            ) : null}
            <span>
              {isProfitable
                ? "Profitable"
                : isLoss
                  ? "Net loss"
                  : "Break-even"}
            </span>
          </div>
        </div>

        <div className="mt-3">
          <div
            className={`text-2xl font-bold tracking-tight ${
              isProfitable
                ? "text-emerald-600 dark:text-emerald-400"
                : isLoss
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-slate-800 dark:text-white"
            }`}
          >
            KSh {formatAmount(netProfit)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Net margin: <strong className="font-semibold text-slate-700 dark:text-slate-200">{formatPercent(netMargin)}</strong></span>
            <span>After COGS & opex</span>
          </div>
        </div>
      </div>

      {/* 2. Gross revenue & volume */}
      <div className={DASHBOARD_CARD_3D}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Gross revenue
          </span>
          <div className="flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
            <Receipt className="h-3 w-3" />
            <span>{saleCount} sales</span>
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            KSh {formatAmount(revenueTotal)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Avg ticket: <strong className="font-semibold text-slate-700 dark:text-slate-200">KSh {formatAmount(avgTicket)}</strong></span>
            <span>Total orders</span>
          </div>
        </div>
      </div>

      {/* 3. Costs & overhead */}
      <div className={DASHBOARD_CARD_3D}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Total costs & opex
          </span>
          <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <PieChartIcon className="h-3 w-3" />
            <span>Gross margin: {formatPercent(grossMargin)}</span>
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            KSh {formatAmount(totalCost)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>COGS: KSh {formatAmount(cogsTotal)}</span>
            <span>Opex: KSh {formatAmount(expenseTotal + utilitiesTotal)}</span>
          </div>
        </div>
      </div>

      {/* 4. Stock valuation & inventory state */}
      <div className={DASHBOARD_CARD_3D}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Stock asset valuation
          </span>
          <div
            className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              criticalStockCount > 0
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
            }`}
          >
            <Boxes className="h-3 w-3" />
            <span>
              {criticalStockCount > 0
                ? `${criticalStockCount} items critical`
                : "All items stocked"}
            </span>
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            KSh {formatAmount(totalStockValue)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{totalTrackedItems} tracked items</span>
            <span>At purchase cost</span>
          </div>
        </div>
      </div>
    </div>
  );
}
