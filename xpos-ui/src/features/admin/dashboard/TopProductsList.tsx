import { Trophy, AlertCircle } from "lucide-react";
import { formatAmount } from "@/utils/formatCurrency";
import type { AnalyticsTopItem } from "@/api/operatorAnalytics";
import { DASHBOARD_CARD_STATIC_3D } from "./dashboardStyles";

interface TopProductsListProps {
  topItems: AnalyticsTopItem[];
  isLoading: boolean;
}

export function TopProductsList({ topItems, isLoading }: TopProductsListProps) {
  const maxRevenue = topItems.length > 0 ? Math.max(...topItems.map((i) => i.totalRevenue)) : 1;

  return (
    <div className={DASHBOARD_CARD_STATIC_3D}>
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-700/60">
        <div className="rounded-lg bg-sky-100 p-2 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-white">
            Top revenue drivers
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Leading products by sales contribution and volume
          </p>
        </div>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="flex h-[200px] w-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500 dark:border-slate-700" />
          </div>
        ) : topItems.length === 0 ? (
          <div className="flex h-[200px] flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <AlertCircle className="h-8 w-8 stroke-[1.5]" />
            <p className="mt-2 text-sm">No sales recorded for this period</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topItems.slice(0, 5).map((item, index) => {
              const pct = maxRevenue > 0 ? (item.totalRevenue / maxRevenue) * 100 : 0;
              return (
                <div key={item.itemId || index} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        {index + 1}
                      </span>
                      <span className="truncate font-medium text-slate-800 dark:text-white" title={item.itemName}>
                        {item.itemName}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 font-medium">
                      <span className="text-slate-400 text-[11px]">{formatAmount(item.totalQty)} sold</span>
                      <span className="text-slate-900 dark:text-white">
                        KSh {formatAmount(item.totalRevenue)}
                      </span>
                    </div>
                  </div>

                  {/* Relative contribution bar - solid sky color, no gradient */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className="h-full bg-sky-500 transition-all duration-300 dark:bg-sky-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
