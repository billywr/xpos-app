import { useMemo } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { formatAmount, formatPercent } from "@/utils/formatCurrency";
import { DASHBOARD_CARD_STATIC_3D } from "./dashboardStyles";
import { WalletCards, AlertCircle } from "lucide-react";

interface CostStructureChartProps {
  cogsTotal: number;
  expenseTotal: number;
  utilitiesTotal: number;
  isLoading: boolean;
}

const COST_COLORS = {
  COGS: "#f59e0b", // Amber 500
  "Operating expenses": "#8b5cf6", // Purple 500
  Utilities: "#06b6d4", // Cyan 500
};

interface CustomPieTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: {
      name: string;
      value: number;
      color: string;
    };
  }>;
}

function CustomPieTooltip({ active, payload }: CustomPieTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;

  return (
    <div className="z-50 rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: item.color }}
        />
        <span>{item.name}</span>
      </div>
      <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
        KSh {formatAmount(item.value)}
      </div>
    </div>
  );
}

export function CostStructureChart({
  cogsTotal,
  expenseTotal,
  utilitiesTotal,
  isLoading,
}: CostStructureChartProps) {
  const totalCost = cogsTotal + expenseTotal + utilitiesTotal;

  const costData = useMemo(() => {
    if (totalCost === 0) return [];
    const items = [
      { name: "COGS (inventory)", value: cogsTotal, color: COST_COLORS.COGS },
      { name: "Operating expenses", value: expenseTotal, color: COST_COLORS["Operating expenses"] },
      { name: "Recurring utilities", value: utilitiesTotal, color: COST_COLORS.Utilities },
    ];
    return items.filter((item) => item.value > 0);
  }, [cogsTotal, expenseTotal, utilitiesTotal, totalCost]);

  return (
    <div className={DASHBOARD_CARD_STATIC_3D}>
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-700/60">
        <div className="rounded-lg bg-amber-100 p-2 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
          <WalletCards className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-white">
            Cost & overhead structure
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Breakdown of COGS, operating, and utility expenses
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center">
        {isLoading ? (
          <div className="flex h-[240px] w-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-amber-500 dark:border-slate-700" />
          </div>
        ) : totalCost === 0 ? (
          <div className="flex h-[240px] flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <AlertCircle className="h-8 w-8 stroke-[1.5]" />
            <p className="mt-2 text-sm">No recorded expenses for this period</p>
          </div>
        ) : (
          <>
            <div className="relative h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Pie
                    data={costData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {costData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke="transparent"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] tracking-wider text-slate-400">Total outflow</span>
                <span className="text-xs font-bold text-slate-800 dark:text-white">
                  KSh {formatAmount(totalCost)}
                </span>
              </div>
            </div>

            <div className="mt-2 w-full space-y-2">
              {costData.map((item) => {
                const pct = totalCost > 0 ? (item.value / totalCost) * 100 : 0;
                return (
                  <div
                    key={item.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-slate-600 dark:text-slate-300">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-medium">
                      <span className="text-slate-800 dark:text-white">
                        KSh {formatAmount(item.value)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ({formatPercent(pct, 1)})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
