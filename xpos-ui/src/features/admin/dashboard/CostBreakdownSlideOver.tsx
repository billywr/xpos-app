import { useState, useMemo, useEffect } from "react";
import {
  Search,
  X,
  Receipt,
  Zap,
  Calendar,
  User,
  Filter,
} from "lucide-react";
import { SlideOver } from "@/components/ui/SlideOver";
import { Pagination } from "@/components/ui/Pagination";
import { CountBadge } from "@/components/ui/CountBadge";
import { TableRowNumberHead, TableRowNumberCell } from "@/components/ui/TableRowNumber";
import type { MiscExpenseResponse } from "@/api/miscExpenses";
import type { RecurringUtility } from "@/api/recurringUtilities";
import { formatAmount } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import { formatMonthYear, getUtilityStatus } from "@/features/operator/UtilitiesTabPanel";
import { cn } from "@/utils/cn";

export interface CostBreakdownSlideOverProps {
  open: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
  expenseTotal: number;
  utilitiesTotal: number;
  expenses: MiscExpenseResponse[];
  utilities: RecurringUtility[];
  isLoading: boolean;
}

type TabType = "ALL" | "EXPENSES" | "UTILITIES";

export function CostBreakdownSlideOver({
  open,
  onClose,
  startDate,
  endDate,
  expenseTotal,
  utilitiesTotal,
  expenses,
  utilities,
  isLoading,
}: CostBreakdownSlideOverProps) {
  const [activeTab, setActiveTab] = useState<TabType>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expensePage, setExpensePage] = useState(0);
  const [expensePageSize, setExpensePageSize] = useState(20);

  const totalOpexAndUtilities = expenseTotal + utilitiesTotal;

  // Compute category totals for operating expenses
  const categoriesSummary = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const exp of expenses) {
      const cat = (exp.category || "Uncategorized").trim();
      const current = map.get(cat) ?? { total: 0, count: 0 };
      map.set(cat, {
        total: current.total + (Number(exp.amount) || 0),
        count: current.count + 1,
      });
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        total: data.total,
        count: data.count,
        percent: expenseTotal > 0 ? (data.total / expenseTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [expenses, expenseTotal]);

  // Filter expenses by search query & selected category
  const filteredExpenses = useMemo(() => {
    if (activeTab === "UTILITIES") return [];
    let list = expenses;

    if (selectedCategory) {
      list = list.filter(
        (exp) => (exp.category || "Uncategorized").trim().toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (exp) =>
          exp.description?.toLowerCase().includes(q) ||
          exp.category?.toLowerCase().includes(q) ||
          exp.incurredBy?.toLowerCase().includes(q) ||
          exp.receiptRef?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [expenses, activeTab, selectedCategory, searchQuery]);

  useEffect(() => {
    setExpensePage(0);
  }, [searchQuery, selectedCategory, activeTab]);

  useEffect(() => {
    if (!open) {
      setExpensePage(0);
    }
  }, [open]);

  const totalExpensePages = Math.max(1, Math.ceil(filteredExpenses.length / expensePageSize));
  const safeExpensePage = Math.min(expensePage, totalExpensePages - 1);

  const paginatedExpenses = useMemo(() => {
    const start = safeExpensePage * expensePageSize;
    return filteredExpenses.slice(start, start + expensePageSize);
  }, [filteredExpenses, safeExpensePage, expensePageSize]);

  // Filter utilities by search query
  const filteredUtilities = useMemo(() => {
    if (activeTab === "EXPENSES") return [];
    let list = utilities;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (util) =>
          util.name?.toLowerCase().includes(q) ||
          util.payee?.toLowerCase().includes(q) ||
          util.accountNumber?.toLowerCase().includes(q) ||
          util.incurredBy?.toLowerCase().includes(q) ||
          util.notes?.toLowerCase().includes(q) ||
          util.effectiveFrom?.toLowerCase().includes(q) ||
          (util.effectiveTo && util.effectiveTo.toLowerCase().includes(q)) ||
          formatMonthYear(util.effectiveFrom).toLowerCase().includes(q) ||
          (util.effectiveTo && formatMonthYear(util.effectiveTo).toLowerCase().includes(q))
      );
    }

    return list;
  }, [utilities, activeTab, searchQuery]);

  const utilitiesTimingLabel = useMemo(() => {
    if (filteredUtilities.length === 0) return "";
    const hasEnd = filteredUtilities.some((u) => u.applyTiming === "END_OF_MONTH");
    const beginningUtils = filteredUtilities.filter(
      (u) => (u.applyTiming ?? "BEGINNING_OF_MONTH") === "BEGINNING_OF_MONTH"
    );
    const distinctDays = Array.from(
      new Set(beginningUtils.map((u) => u.dueDayOfMonth ?? 1))
    ).sort((a, b) => a - b);

    if (hasEnd && distinctDays.length > 0) {
      const dayStr = distinctDays.map((d) => `day ${d}`).join(", ");
      return `Applies ${dayStr} or last day of every month`;
    }
    if (hasEnd) {
      return "Applies last day of every month";
    }
    if (distinctDays.length === 1) {
      return `Applies day ${distinctDays[0]} of every month`;
    }
    if (distinctDays.length > 1) {
      return `Applies days ${distinctDays.join(", ")} of every month`;
    }
    return "Applies day 1 of every month";
  }, [filteredUtilities]);

  const totalFilteredCount =
    (activeTab !== "UTILITIES" ? filteredExpenses.length : 0) +
    (activeTab !== "EXPENSES" ? filteredUtilities.length : 0);

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Cost & expense breakdown"
    >
      <div className="space-y-6">
        {/* Period & Top Overview Header Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700/80 dark:bg-slate-800/60">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3 text-xs dark:border-slate-700/80">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Calendar className="h-3.5 w-3.5" />
              <span>Period:</span>
              <strong className="font-semibold text-slate-700 dark:text-slate-200">
                {startDate === endDate
                  ? formatDate(startDate)
                  : `${formatDate(startDate)} to ${formatDate(endDate)}`}
              </strong>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Excluding cost of goods
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Total expenses
              </span>
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                KSh {formatAmount(totalOpexAndUtilities)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs dark:border-amber-900/60 dark:bg-amber-950/40">
                <span className="text-amber-700 dark:text-amber-300">Opex: </span>
                <strong className="font-bold text-amber-900 dark:text-amber-200">
                  KSh {formatAmount(expenseTotal)}
                </strong>
              </div>
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs dark:border-cyan-900/60 dark:bg-cyan-950/40">
                <span className="text-cyan-700 dark:text-cyan-300">Utilities: </span>
                <strong className="font-bold text-cyan-900 dark:text-cyan-200">
                  KSh {formatAmount(utilitiesTotal)}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls: Tabs & Search */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("ALL");
                  setSelectedCategory(null);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  activeTab === "ALL"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                <span>All</span>
                <CountBadge
                  count={expenses.length + utilities.length}
                  variant="neutral"
                  active={activeTab === "ALL"}
                  size="sm"
                />
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("EXPENSES");
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  activeTab === "EXPENSES"
                    ? "bg-amber-600 text-white shadow-sm dark:bg-amber-500"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                <span>Operating expenses</span>
                <CountBadge
                  count={expenses.length}
                  variant="amber"
                  active={activeTab === "EXPENSES"}
                  size="sm"
                />
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("UTILITIES");
                  setSelectedCategory(null);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  activeTab === "UTILITIES"
                    ? "bg-cyan-600 text-white shadow-sm dark:bg-cyan-500"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                <span>Recurring utilities</span>
                <CountBadge
                  count={utilities.length}
                  variant="indigo"
                  active={activeTab === "UTILITIES"}
                  size="sm"
                />
              </button>
            </div>

            {/* Live Search */}
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search descriptions, payees..."
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-700/60 dark:text-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Pills (When showing expenses) */}
          {activeTab !== "UTILITIES" && categoriesSummary.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                <Filter className="h-3 w-3" />
                Category:
              </span>
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all",
                  selectedCategory === null
                    ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                )}
              >
                All categories
              </button>
              {categoriesSummary.map((cat) => {
                const isSelected = selectedCategory?.toLowerCase() === cat.name.toLowerCase();
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() =>
                      setSelectedCategory(isSelected ? null : cat.name)
                    }
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all",
                      isSelected
                        ? "bg-amber-600 text-white shadow-sm dark:bg-amber-500"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                    )}
                  >
                    <span>{cat.name}</span>
                    <CountBadge
                      count={cat.count}
                      variant={isSelected ? "amber" : "neutral"}
                      active={isSelected}
                      size="sm"
                    />
                    <span className="text-[10px] opacity-75">
                      · {formatAmount(cat.total)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Content Section: Lists & Tables */}
        {isLoading ? (
          <div className="space-y-3 py-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600 dark:border-slate-700" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Loading cost breakdown...
            </p>
          </div>
        ) : totalFilteredCount === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-700">
            <Receipt className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500" />
            <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              No matching costs or expenses
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {searchQuery || selectedCategory
                ? "Try clearing your search query or category filter."
                : "No operating expenses or utilities recorded for this period."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Section 1: Recurring Utilities (if applicable) */}
            {activeTab !== "EXPENSES" && filteredUtilities.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-cyan-700 dark:text-cyan-400">
                    <Zap className="h-4 w-4" />
                    <span>Recurring utilities</span>
                    <CountBadge
                      count={filteredUtilities.length}
                      variant="indigo"
                      size="sm"
                    />
                    {utilitiesTimingLabel && (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100/80 px-2 py-0.5 text-[11px] font-normal text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {utilitiesTimingLabel}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Subtotal: KSh {formatAmount(utilitiesTotal)}
                  </span>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-700/50 dark:text-slate-400">
                        <tr>
                          <TableRowNumberHead className="w-10 py-2.5 pl-3 pr-2 text-left font-semibold text-slate-500 dark:text-slate-400" />
                          <th className="px-2 py-2.5">Utility</th>
                          <th className="px-2 py-2.5">Applies</th>
                          <th className="px-2 py-2.5">Status</th>
                          <th className="py-2.5 pl-2 pr-3">Amount (KSH)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                        {filteredUtilities.map((util, index) => {
                          const effectiveFrom =
                            util.effectiveFrom ||
                            (util.createdAt ? util.createdAt.slice(0, 10) : "");
                          const status = getUtilityStatus(util);
                          const appliesText = effectiveFrom
                            ? util.effectiveTo
                              ? `${formatMonthYear(effectiveFrom)} – ${formatMonthYear(util.effectiveTo)}`
                              : `From ${formatMonthYear(effectiveFrom)}`
                            : "—";

                          return (
                            <tr
                              key={util.id}
                              className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/40"
                            >
                              <TableRowNumberCell
                                page={0}
                                pageSize={filteredUtilities.length}
                                indexInPage={index}
                                className="whitespace-nowrap py-2 pl-3 pr-2 font-mono text-[11px] text-slate-400 dark:text-slate-500"
                              />
                              <td className="whitespace-nowrap px-2 py-2 font-medium text-slate-900 dark:text-white">
                                {util.name}
                              </td>
                              <td className="whitespace-nowrap px-2 py-2 text-slate-700 dark:text-slate-300">
                                {appliesText}
                              </td>
                              <td className="whitespace-nowrap px-2 py-2">
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                                    status.className
                                  )}
                                >
                                  {status.label.toLowerCase()}
                                </span>
                              </td>
                              <td className="whitespace-nowrap py-2 pl-2 pr-3 font-semibold tabular-nums text-slate-900 dark:text-white">
                                {formatAmount(util.amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Section 2: Operating Expenses Transaction Ledger (if applicable) */}
            {activeTab !== "UTILITIES" && filteredExpenses.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <Receipt className="h-4 w-4" />
                    <span>Operating expenses</span>
                    <CountBadge
                      count={filteredExpenses.length}
                      variant="amber"
                      size="sm"
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Subtotal: KSh {formatAmount(expenseTotal)}
                  </span>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-700/50 dark:text-slate-400">
                        <tr>
                          <TableRowNumberHead className="w-10 py-2.5 pl-3 pr-2 text-left font-semibold text-slate-500 dark:text-slate-400" />
                          <th className="px-2 py-2.5">Date</th>
                          <th className="px-2 py-2.5">Category</th>
                          <th className="px-2 py-2.5">Incurred by</th>
                          <th className="py-2.5 pl-2 pr-3">Amount (KSH)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                        {paginatedExpenses.map((exp, index) => (
                          <tr
                            key={exp.id}
                            className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/40"
                          >
                            <TableRowNumberCell
                              page={safeExpensePage}
                              pageSize={expensePageSize}
                              indexInPage={index}
                              className="whitespace-nowrap py-2 pl-3 pr-2 font-mono text-[11px] text-slate-400 dark:text-slate-500"
                            />
                            <td className="whitespace-nowrap px-2 py-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                              {formatDate(exp.createdAt)}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2">
                              <span
                                className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                                title={exp.description || undefined}
                              >
                                {exp.category || exp.description || "General"}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 text-slate-600 dark:text-slate-400">
                              {exp.incurredBy ? (
                                <span className="inline-flex items-center gap-1">
                                  <User className="h-3 w-3 text-slate-400" />
                                  <span>{exp.incurredBy}</span>
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="whitespace-nowrap py-2 pl-2 pr-3 font-semibold tabular-nums text-slate-900 dark:text-white">
                              {formatAmount(exp.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    page={safeExpensePage}
                    size={expensePageSize}
                    totalElements={filteredExpenses.length}
                    onPageChange={setExpensePage}
                    onSizeChange={(newSize) => {
                      setExpensePageSize(newSize);
                      setExpensePage(0);
                    }}
                    sizeOptions={[10, 20, 50, 100]}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </SlideOver>
  );
}
