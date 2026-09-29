import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import { fetchRevenueDashboard } from "@/api/revenueDashboard";
import { fetchMiscExpenses } from "@/api/miscExpenses";
import type { Org, Branch } from "@/types/org";
import { filterActiveOrgs, filterNonDeletedBranches } from "@/types/org";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatCurrency, formatPercent } from "@/utils/formatCurrency";
import { cn } from "@/utils/cn";
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Percent,
  Package,
  CircleDollarSign,
  AlertTriangle,
  CreditCard,
  ChevronRight,
  Search,
  X,
  Calendar,
} from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { DateInput } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toLocalDateStr(isoString: string): string {
  try {
    const d = new Date(isoString);
    return formatLocalDate(d);
  } catch {
    return isoString.slice(0, 10);
  }
}

type PresetRange = "today" | "7days" | "30days" | "thisMonth" | "custom";

function getRangeDates(preset: PresetRange): { start: string; end: string } {
  const now = new Date();
  const today = formatLocalDate(now);
  if (preset === "today") {
    return { start: today, end: today };
  }
  if (preset === "7days") {
    const s = new Date(now);
    s.setDate(s.getDate() - 7);
    return { start: formatLocalDate(s), end: today };
  }
  if (preset === "thisMonth") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: formatLocalDate(s), end: today };
  }
  // 30days default
  const s = new Date(now);
  s.setDate(s.getDate() - 30);
  return { start: formatLocalDate(s), end: today };
}

function AnimatedNumber({
  value,
  duration = 0.8,
}: {
  value: number;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [value, duration]);

  return <span>{formatCurrency(display)}</span>;
}

function AnimatedCount({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    const startTime = performance.now();
    const duration = 0.6;

    const tick = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [value]);

  return <span>{display}</span>;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4 },
  }),
};

const chartVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, delay: 0.3 },
  },
};

export function RevenueDashboardPage() {
  const toast = useToast();
  const token = useAppSelector(selectToken);
  const [activePreset, setActivePreset] = useState<PresetRange>("30days");
  const initialDates = useMemo(() => getRangeDates("30days"), []);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);
  const [submittedRange, setSubmittedRange] = useState<{
    start: string;
    end: string;
  } | null>(null);

  // Expense breakdown modal & filter state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const { data: branchesData } = useQuery({
    queryKey: ["admin-branches", token, selectedOrgId],
    queryFn: () => fetchBranches(token, selectedOrgId, { size: 200 }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });

  const {
    data: dashboard,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: [
      "admin-revenue-dashboard",
      token,
      selectedOrgId,
      selectedBranchId,
      submittedRange?.start,
      submittedRange?.end,
    ],
    queryFn: () =>
      fetchRevenueDashboard(
        token,
        selectedOrgId,
        selectedBranchId,
        submittedRange!.start,
        submittedRange!.end
      ),
    enabled:
      Boolean(token) &&
      Boolean(selectedOrgId) &&
      Boolean(selectedBranchId) &&
      Boolean(submittedRange),
  });

  const { data: expensesData } = useQuery({
    queryKey: [
      "admin-revenue-expenses",
      token,
      selectedOrgId,
      selectedBranchId,
      submittedRange?.start,
      submittedRange?.end,
    ],
    queryFn: () =>
      fetchMiscExpenses(token, selectedOrgId, selectedBranchId, {
        fromDate: submittedRange!.start,
        toDate: submittedRange!.end,
        size: 500,
      }),
    enabled:
      Boolean(token) &&
      Boolean(selectedOrgId) &&
      Boolean(selectedBranchId) &&
      Boolean(submittedRange),
  });

  const orgs = filterActiveOrgs(orgsData?.content ?? []);
  const branches = filterNonDeletedBranches(branchesData?.content ?? []);

  const orgSelectOptions = useMemo(
    () => [
      { value: "", label: "Select organization…" },
      ...orgs.map((org: Org) => ({ value: org.id, label: org.name })),
    ],
    [orgs]
  );

  const branchSelectOptions = useMemo(
    () => [
      { value: "", label: "Select branch…" },
      ...branches.map((branch: Branch) => ({
        value: branch.id,
        label: branch.name,
      })),
    ],
    [branches]
  );

  useEffect(() => {
    if (!selectedOrgId && orgs.length > 0) setSelectedOrgId(orgs[0].id);
  }, [orgs, selectedOrgId]);

  useEffect(() => {
    if (selectedOrgId && !selectedBranchId && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [selectedOrgId, branches, selectedBranchId]);

  useEffect(() => {
    if (
      selectedOrgId &&
      selectedBranchId &&
      startDate &&
      endDate &&
      !submittedRange
    ) {
      setSubmittedRange({ start: startDate, end: endDate });
    }
  }, [selectedOrgId, selectedBranchId, startDate, endDate, submittedRange]);

  const handleSelectPreset = (preset: PresetRange) => {
    setActivePreset(preset);
    if (preset !== "custom") {
      const r = getRangeDates(preset);
      setStartDate(r.start);
      setEndDate(r.end);
      if (selectedOrgId && selectedBranchId) {
        setSubmittedRange({ start: r.start, end: r.end });
      }
    }
  };

  const handleStartDateChange = (newStart: string) => {
    setActivePreset("custom");
    if (endDate && newStart && newStart > endDate) {
      setStartDate(newStart);
      setEndDate(newStart);
      setSubmittedRange(null);
      toast.error(
        "Start date cannot be after end date. End date automatically adjusted.",
        { title: "Date Adjusted" }
      );
      return;
    }
    setStartDate(newStart);
    setSubmittedRange(null);
  };

  const handleEndDateChange = (newEnd: string) => {
    setActivePreset("custom");
    if (startDate && newEnd && newEnd < startDate) {
      setStartDate(newEnd);
      setEndDate(newEnd);
      setSubmittedRange(null);
      toast.error(
        "End date cannot be before start date. Start date automatically adjusted.",
        { title: "Date Adjusted" }
      );
      return;
    }
    setEndDate(newEnd);
    setSubmittedRange(null);
  };

  const handleLoad = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrgId && selectedBranchId && startDate && endDate) {
      let finalStart = startDate;
      let finalEnd = endDate;
      if (finalEnd < finalStart) {
        finalStart = finalEnd;
        setStartDate(finalEnd);
        toast.error(
          "End date cannot be before start date. Dates adjusted automatically.",
          { title: "Date Adjusted" }
        );
      }
      setSubmittedRange({ start: finalStart, end: finalEnd });
    }
  };

  const expenseTotal = useMemo(() => {
    const fromApi = Number(expensesData?.totalAmount ?? 0);
    const fromDash = Number(dashboard?.summary?.expenseTotal ?? 0);
    return fromApi > 0 ? fromApi : fromDash;
  }, [expensesData?.totalAmount, dashboard?.summary?.expenseTotal]);

  const grossProfit = useMemo(() => {
    if (!dashboard?.summary) return 0;
    const { revenueTotal, cogsTotal } = dashboard.summary;
    return revenueTotal - cogsTotal;
  }, [dashboard]);

  const grossMargin = useMemo(() => {
    if (!dashboard?.summary || dashboard.summary.revenueTotal <= 0) return 0;
    return (grossProfit / dashboard.summary.revenueTotal) * 100;
  }, [dashboard, grossProfit]);

  const netProfit = useMemo(() => {
    if (!dashboard?.summary) return 0;
    const { revenueTotal, cogsTotal } = dashboard.summary;
    return revenueTotal - cogsTotal - expenseTotal;
  }, [dashboard, expenseTotal]);

  const netMargin = useMemo(() => {
    if (!dashboard?.summary || dashboard.summary.revenueTotal <= 0) return 0;
    return (netProfit / dashboard.summary.revenueTotal) * 100;
  }, [dashboard, netProfit]);

  const expenseCategoriesSummary = useMemo(() => {
    const list = expensesData?.content ?? [];
    const map: Record<string, { count: number; total: number }> = {};
    for (const exp of list) {
      const cat = exp.category || "General";
      if (!map[cat]) map[cat] = { count: 0, total: 0 };
      map[cat].count += 1;
      map[cat].total += Number(exp.amount || 0);
    }
    const total = Number(expensesData?.totalAmount || expenseTotal || 0);
    return Object.entries(map)
      .map(([category, data]) => ({
        category,
        count: data.count,
        total: data.total,
        percentage: total > 0 ? (data.total / total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [expensesData?.content, expensesData?.totalAmount, expenseTotal]);

  const filteredExpenses = useMemo(() => {
    let list = expensesData?.content ?? [];
    if (selectedCategoryFilter !== "ALL") {
      list = list.filter((e) => (e.category || "General") === selectedCategoryFilter);
    }
    if (expenseSearch.trim()) {
      const q = expenseSearch.toLowerCase();
      list = list.filter(
        (e) =>
          e.description?.toLowerCase().includes(q) ||
          e.category?.toLowerCase().includes(q) ||
          e.incurredBy?.toLowerCase().includes(q) ||
          e.receiptRef?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [expensesData?.content, selectedCategoryFilter, expenseSearch]);

  const dailyExpensesMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (expensesData?.content) {
      for (const exp of expensesData.content) {
        if (!exp.createdAt || exp.amount == null) continue;
        const d = toLocalDateStr(exp.createdAt);
        map[d] = (map[d] ?? 0) + Number(exp.amount);
      }
    }
    return map;
  }, [expensesData?.content]);

  const chartData = useMemo(() => {
    return (dashboard?.trend ?? []).map((t) => {
      const fullDate = t.date;
      const apiExp = dailyExpensesMap[fullDate] ?? 0;
      const finalExp = (t.expenses && t.expenses > 0) ? t.expenses : apiExp;
      return {
        date: t.date.slice(5),
        revenue: t.revenue,
        tax: t.tax,
        cogs: t.cogs,
        expenses: finalExp,
        netProfit: t.netProfit ?? (t.revenue - t.cogs - finalExp),
        sales: t.saleCount,
      };
    });
  }, [dashboard?.trend, dailyExpensesMap]);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-white">
            <TrendingUp className="h-7 w-7 text-emerald-500" />
            Revenue &amp; P&amp;L
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Business revenue status, profit and loss tracking with trends.
          </p>
        </div>
      </div>

      {/* Quick Range Presets */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Quick Range:
        </span>
        {(
          [
            { key: "today", label: "Today" },
            { key: "7days", label: "7 Days" },
            { key: "30days", label: "30 Days" },
            { key: "thisMonth", label: "This Month" },
            { key: "custom", label: "Custom" },
          ] as const
        ).map((p) => {
          const isSelected = activePreset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => handleSelectPreset(p.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                isSelected
                  ? "bg-primary-600 text-white shadow-sm dark:bg-primary-500"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleLoad} className="mb-6 flex flex-wrap items-end gap-4">
        {orgs.length > 1 && (
          <div className="flex min-w-[12rem] flex-1 flex-col gap-1 sm:flex-initial">
            <label
              htmlFor="revenue-dash-org"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Organization
            </label>
            <SearchableSelect
              id="revenue-dash-org"
              options={orgSelectOptions}
              value={selectedOrgId}
              onChange={(next) => {
                setSelectedOrgId(next);
                setSelectedBranchId("");
                setSubmittedRange(null);
              }}
              placeholder="Search organization…"
              className="min-w-[12rem]"
              controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
            />
          </div>
        )}
        {branches.length > 1 && (
          <div className="flex min-w-[12rem] flex-1 flex-col gap-1 sm:flex-initial">
            <label
              htmlFor="revenue-dash-branch"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Branch
            </label>
            <SearchableSelect
              id="revenue-dash-branch"
              options={branchSelectOptions}
              value={selectedBranchId}
              onChange={(next) => {
                setSelectedBranchId(next);
                setSubmittedRange(null);
              }}
              placeholder="Search branch…"
              className="min-w-[12rem]"
              controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
            />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-initial">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Start date
          </label>
          <DateInput
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-initial">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            End date
          </label>
          <DateInput
            value={endDate}
            onChange={(e) => handleEndDateChange(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
        </div>
        <button
          type="submit"
          disabled={!selectedOrgId || !selectedBranchId || !startDate || !endDate}
          className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-500 disabled:opacity-50 sm:w-auto"
        >
          Load dashboard
        </button>
      </form>

      {!selectedOrgId || !selectedBranchId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-12 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select organization and branch, then choose a date range and load the dashboard.
        </div>
      ) : !submittedRange ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
          Choose a date range and click &quot;Load dashboard&quot;.
        </div>
      ) : isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          <p className="mt-4">Loading revenue data…</p>
        </div>
      ) : isError ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            <div>
              <p className="font-semibold">{getApiErrorMessage(error)}</p>
              <p className="mt-1 text-sm opacity-90">
                Please adjust your date range or selection above and click &quot;Load dashboard&quot; to try again.
              </p>
            </div>
          </div>
        </div>
      ) : dashboard ? (
        <motion.div
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
            {/* 0. Revenue */}
            <motion.div
              variants={cardVariants}
              custom={0}
              className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm transition hover:shadow-md dark:border-slate-700 dark:from-emerald-950/30 dark:to-slate-800"
            >
              <div className="p-4">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <DollarSign className="h-5 w-5" />
                  <span className="text-sm font-medium">Revenue</span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                  <AnimatedNumber value={dashboard.summary.revenueTotal} />
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Total gross sales</p>
              </div>
            </motion.div>

            {/* 1. Cost of goods */}
            <motion.div
              variants={cardVariants}
              custom={1}
              className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-rose-50 to-white shadow-sm transition hover:shadow-md dark:border-slate-700 dark:from-rose-950/30 dark:to-slate-800"
            >
              <div className="p-4">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <Package className="h-5 w-5" />
                  <span className="text-sm font-medium">Cost of goods</span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                  <AnimatedNumber value={dashboard.summary.cogsTotal} />
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Direct product cost</p>
              </div>
            </motion.div>

            {/* 2. Profit (Before Expenses) */}
            <motion.div
              variants={cardVariants}
              custom={2}
              className="overflow-hidden rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white shadow-sm transition hover:shadow-md dark:border-teal-800/60 dark:from-teal-950/30 dark:to-slate-800"
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400">
                    <TrendingUp className="h-5 w-5" />
                    <span className="text-sm font-medium">Profit</span>
                  </div>
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700 dark:bg-teal-900/50 dark:text-teal-300">
                    {formatPercent(grossMargin, 2)}
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                  <AnimatedNumber value={grossProfit} />
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Before expenses</p>
              </div>
            </motion.div>

            {/* 3. Expenses (Interactive Breakdown) */}
            <motion.div
              variants={cardVariants}
              custom={3}
              onClick={() => setShowExpenseModal(true)}
              className="group relative cursor-pointer overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-sm transition-all duration-200 hover:border-amber-400 hover:shadow-md dark:border-slate-700 dark:from-amber-950/30 dark:to-slate-800 dark:hover:border-amber-500"
              title="Click to see breakdown of expenses for this period"
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <CreditCard className="h-5 w-5" />
                    <span className="text-sm font-medium">Expenses</span>
                  </div>
                  <span className="flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 transition group-hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:group-hover:bg-amber-900/60">
                    <span>Breakdown</span>
                    <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                  <AnimatedNumber value={expenseTotal} />
                </p>
                <p className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>{expensesData?.content?.length ?? 0} items</span>
                  <span className="text-amber-600 underline group-hover:font-medium dark:text-amber-400">View details</span>
                </p>
              </div>
            </motion.div>

            {/* 4. Net profit */}
            <motion.div
              variants={cardVariants}
              custom={4}
              className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-violet-50 to-white shadow-sm transition hover:shadow-md dark:border-slate-700 dark:from-violet-950/30 dark:to-slate-800"
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                    <CircleDollarSign className="h-5 w-5" />
                    <span className="text-sm font-medium">Net profit</span>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      netProfit >= 0
                        ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
                    )}
                  >
                    {formatPercent(netMargin, 2)}
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                  <AnimatedNumber value={netProfit} />
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Profit - Expenses</p>
              </div>
            </motion.div>

            {/* 5. Tax */}
            <motion.div
              variants={cardVariants}
              custom={5}
              className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-blue-50 to-white shadow-sm transition hover:shadow-md dark:border-slate-700 dark:from-blue-950/30 dark:to-slate-800"
            >
              <div className="p-4">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Percent className="h-5 w-5" />
                  <span className="text-sm font-medium">Tax</span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                  <AnimatedNumber value={dashboard.summary.taxTotal} />
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">VAT / Tax collected</p>
              </div>
            </motion.div>

            {/* 6. Sales */}
            <motion.div
              variants={cardVariants}
              custom={6}
              className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-sky-50 to-white shadow-sm transition hover:shadow-md dark:border-slate-700 dark:from-sky-950/30 dark:to-slate-800"
            >
              <div className="p-4">
                <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
                  <Receipt className="h-5 w-5" />
                  <span className="text-sm font-medium">Sales</span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                  <AnimatedCount value={dashboard.summary.saleCount} />
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Completed receipts</p>
              </div>
            </motion.div>
          </div>

          <AnimatePresence>
            {chartData.length > 0 ? (
              <motion.div
                variants={chartVariants}
                className="grid gap-6 lg:grid-cols-2"
              >
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <h3 className="mb-4 font-semibold text-slate-800 dark:text-white">
                    Revenue trend
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-600" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `KSh ${v}`} />
                        <Tooltip
                          formatter={(v: number | undefined) =>
                            [v != null ? formatCurrency(v) : "—", "Revenue"]}
                          labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          stroke="rgb(16, 185, 129)"
                          strokeWidth={2}
                          dot={{ fill: "rgb(16, 185, 129)", r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <h3 className="mb-4 font-semibold text-slate-800 dark:text-white">
                    Daily revenue
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-600" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `KSh ${v}`} />
                        <Tooltip
                          formatter={(v: number | undefined) =>
                            [v != null ? formatCurrency(v) : "—", "Revenue"]}
                          labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Bar dataKey="revenue" fill="rgb(16, 185, 129)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              >
                No sales in this period. Charts will appear when there is revenue data.
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ) : null}

      {/* Expense Breakdown Modal */}
      <Modal
        open={showExpenseModal}
        onClose={() => {
          setShowExpenseModal(false);
          setExpenseSearch("");
          setSelectedCategoryFilter("ALL");
        }}
        title="Expense Breakdown"
        maxWidth="max-w-3xl"
        scrollable
      >
        <div className="space-y-4">
          {/* Header context */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/70 bg-amber-50/60 p-3.5 dark:border-amber-800/40 dark:bg-amber-950/20">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Period Filter
              </span>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {submittedRange?.start === submittedRange?.end
                  ? `Today (${submittedRange?.start})`
                  : `${submittedRange?.start} to ${submittedRange?.end}`}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Total Expenses
              </span>
              <p className="text-lg font-bold text-amber-900 dark:text-amber-200">
                {formatCurrency(expenseTotal)}
              </p>
            </div>
          </div>

          {/* Category Chips Distribution */}
          {expenseCategoriesSummary.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Category Distribution
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter("ALL")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-medium transition",
                    selectedCategoryFilter === "ALL"
                      ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900"
                      : "border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  )}
                >
                  All ({expensesData?.content?.length ?? 0})
                </button>
                {expenseCategoriesSummary.map((cat) => {
                  const isCatSelected = selectedCategoryFilter === cat.category;
                  return (
                    <button
                      key={cat.category}
                      type="button"
                      onClick={() =>
                        setSelectedCategoryFilter(
                          isCatSelected ? "ALL" : cat.category
                        )
                      }
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition",
                        isCatSelected
                          ? "bg-amber-600 text-white shadow-sm dark:bg-amber-500"
                          : "border border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
                      )}
                    >
                      <span>{cat.category}</span>
                      <span className="opacity-80">({formatCurrency(cat.total)})</span>
                      <span className="rounded bg-black/10 px-1 text-[10px] dark:bg-white/10">
                        {formatPercent(cat.percentage, 2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={expenseSearch}
              onChange={(e) => setExpenseSearch(e.target.value)}
              placeholder="Search expenses by description, staff, or receipt..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            {expenseSearch && (
              <button
                type="button"
                onClick={() => setExpenseSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Expense Item List */}
          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
            {filteredExpenses.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                <CreditCard className="mx-auto mb-2 h-8 w-8 text-slate-400 opacity-60 dark:text-slate-500" />
                <p className="font-medium">No expenses recorded</p>
                <p className="mt-1 text-xs text-slate-400">
                  No expense records match the selected date filter and criteria.
                </p>
              </div>
            ) : (
              filteredExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-center justify-between p-3.5 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/40"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                        {exp.category || "General"}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Calendar className="h-3 w-3" />
                        {toLocalDateStr(exp.createdAt)}
                      </span>
                      {exp.receiptRef && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          Ref: {exp.receiptRef}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-slate-900 dark:text-white">
                      {exp.description || "No description"}
                    </p>
                    {exp.incurredBy && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Incurred by: {exp.incurredBy}
                      </p>
                    )}
                  </div>
                  <div className="whitespace-nowrap text-right">
                    <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(exp.amount)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setShowExpenseModal(false)}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
