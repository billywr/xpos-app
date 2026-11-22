import { Link } from "react-router-dom";
import { Boxes, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { formatAmount } from "@/utils/formatCurrency";
import type { InventoryReportLineResponse } from "@/api/inventoryReport";
import { DASHBOARD_CARD_STATIC_3D } from "./dashboardStyles";

interface StockHealthSectionProps {
  inventoryItems: InventoryReportLineResponse[];
  isLoading: boolean;
  lowStockCount: number;
  outOfStockCount: number;
  healthyStockCount: number;
}

export function StockHealthSection({
  inventoryItems,
  isLoading,
  lowStockCount,
  outOfStockCount,
  healthyStockCount,
}: StockHealthSectionProps) {
  const totalTracked = lowStockCount + outOfStockCount + healthyStockCount;
  const healthyPct = totalTracked > 0 ? (healthyStockCount / totalTracked) * 100 : 100;
  const lowPct = totalTracked > 0 ? (lowStockCount / totalTracked) * 100 : 0;
  const outPct = totalTracked > 0 ? (outOfStockCount / totalTracked) * 100 : 0;

  // Filter items needing attention: onHandQty <= 10, sorted by onHandQty ascending
  const criticalItems = inventoryItems
    .filter((item) => item.trackInventory && item.onHandQty <= 10)
    .sort((a, b) => a.onHandQty - b.onHandQty)
    .slice(0, 5);

  return (
    <div className={DASHBOARD_CARD_STATIC_3D}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-700/60">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">
              Inventory state & restock watchlist
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live stock levels, critical depletion alerts, and reorder priority
            </p>
          </div>
        </div>

        <Link
          to="/admin/inventory"
          className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
        >
          <span>Manage inventory</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex h-[200px] w-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500 dark:border-slate-700" />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Health Distribution Track */}
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
              <span>Stock health distribution</span>
              <span>{totalTracked} tracked products</span>
            </div>

            {/* Segmented flat bar - no gradients */}
            <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              {healthyPct > 0 && (
                <div
                  className="bg-emerald-500 transition-all duration-300"
                  style={{ width: `${healthyPct}%` }}
                  title={`Healthy: ${healthyStockCount} items`}
                />
              )}
              {lowPct > 0 && (
                <div
                  className="bg-amber-500 transition-all duration-300"
                  style={{ width: `${lowPct}%` }}
                  title={`Low stock: ${lowStockCount} items`}
                />
              )}
              {outPct > 0 && (
                <div
                  className="bg-rose-500 transition-all duration-300"
                  style={{ width: `${outPct}%` }}
                  title={`Out of stock: ${outOfStockCount} items`}
                />
              )}
            </div>

            {/* Legend indicators */}
            <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-slate-600 dark:text-slate-300">
                  Healthy (&gt;10): <strong className="font-semibold text-slate-800 dark:text-white">{healthyStockCount}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-slate-600 dark:text-slate-300">
                  Low stock (1-10): <strong className="font-semibold text-slate-800 dark:text-white">{lowStockCount}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span className="text-slate-600 dark:text-slate-300">
                  Out of stock (0): <strong className="font-semibold text-slate-800 dark:text-white">{outOfStockCount}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Critical Items Table */}
          <div className="overflow-x-auto">
            {criticalItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 stroke-[1.5]" />
                <p className="mt-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                  All inventory levels are healthy
                </p>
                <p className="text-xs">No products currently require immediate restock.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 dark:border-slate-700/60 dark:text-slate-400">
                    <th className="pb-2 font-medium">Item</th>
                    <th className="pb-2 font-medium">SKU</th>
                    <th className="pb-2 font-medium">On hand</th>
                    <th className="pb-2 font-medium">Sold (period)</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                  {criticalItems.map((item) => {
                    const isOut = item.onHandQty <= 0;
                    return (
                      <tr key={item.itemId} className="hover:bg-slate-50 dark:hover:bg-slate-700/20">
                        <td className="py-2.5 font-medium text-slate-800 dark:text-white">
                          {item.itemName}
                        </td>
                        <td className="py-2.5 text-slate-500 dark:text-slate-400 font-mono">
                          {item.sku || "—"}
                        </td>
                        <td className="py-2.5 font-semibold">
                          <span
                            className={
                              isOut
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-amber-600 dark:text-amber-400"
                            }
                          >
                            {formatAmount(item.onHandQty)}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-600 dark:text-slate-300">
                          {formatAmount(item.soldQty)}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              isOut
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            }`}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            {isOut ? "Out of stock" : "Low stock"}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <Link
                            to="/admin/inventory"
                            className="font-medium text-primary-600 hover:underline dark:text-primary-400"
                          >
                            Restock
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
