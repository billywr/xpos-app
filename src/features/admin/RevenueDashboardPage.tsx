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
import { fetchRecurringUtilities } from "@/api/recurringUtilities";
import type { Org, Branch } from "@/types/org";
import { filterActiveOrgs, filterNonDeletedBranches } from "@/types/org";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatCurrency, formatPercent } from "@/utils/formatCurrency";
import { cn } from "@/utils/cn";
import {
  TrendingUp,
  DollarSign,
  Package,
  CircleDollarSign,
  AlertTriangle,
  CreditCard,
  Search,
  X,
  RotateCw,
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

type PresetRange =
  | "today"
  | "thisWeek"
  | "lastWeek"
  | "7days"
  | "thisMonth"
  | "lastMonth"
  | "30days"
  | "thisYear"
  | "lastYear"
  | "custom";

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
    s.setDate(s.getDate() - 7);
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
  if (preset === "thisYear") {
    const s = new Date(now.getFullYear(), 0, 1);
    return { start: formatLocalDate(s), end: today };
  }
  if (preset === "lastYear") {
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
    return { start: formatLocalDate(lastYearStart), end: formatLocalDate(lastYearEnd) };
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
  const [activePreset, setActivePreset] = useState<PresetRange>("today");
  const initialDates = useMemo(() => getRangeDates("today"), []);
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
  const [breakdownTab, setBreakdownTab] = useState<"ALL" | "EXPENSES" | "UTILITIES">("ALL");

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
    isFetching,
    isError,
    error,
    refetch: refetchDashboard,
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

  const { data: expensesData, refetch: refetchExpenses } = useQuery({
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

  const { data: utilitiesData, refetch: refetchUtilities } = useQuery({
    queryKey: [
      "admin-revenue-utilities",
      token,
      selectedOrgId,
      selectedBranchId,
    ],
    queryFn: () =>
      fetchRecurringUtilities(token, selectedOrgId, selectedBranchId, {
        active: true,
        size: 200,
      }),
    enabled:
      Boolean(token) &&
      Boolean(selectedOrgId) &&
      Boolean(selectedBranchId),
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
      if (selectedOrgId && selectedBranchId) {
        setSubmittedRange({ start: newStart, end: newStart });
      }
      toast.error(
        "Start date cannot be after end date. End date automatically adjusted.",
        { title: "Date Adjusted" }
      );
      return;
    }
    setStartDate(newStart);
    if (selectedOrgId && selectedBranchId && newStart && endDate) {
      setSubmittedRange({ start: newStart, end: endDate });
    }
  };

  const handleEndDateChange = (newEnd: string) => {
    setActivePreset("custom");
    if (startDate && newEnd && newEnd < startDate) {
      setStartDate(newEnd);
      setEndDate(newEnd);
      if (selectedOrgId && selectedBranchId) {
        setSubmittedRange({ start: newEnd, end: newEnd });
      }
      toast.error(
        "End date cannot be before start date. Start date automatically adjusted.",
        { title: "Date Adjusted" }
      );
      return;
    }
    setEndDate(newEnd);
    if (selectedOrgId && selectedBranchId && startDate && newEnd) {
      setSubmittedRange({ start: startDate, end: newEnd });
    }
  };

  const handleRefresh = () => {
    if (selectedOrgId && selectedBranchId && startDate && endDate) {
      let finalStart = startDate;
      let finalEnd = endDate;
      if (finalEnd < finalStart) {
        finalStart = finalEnd;
        setStartDate(finalEnd);
      }
      setSubmittedRange({ start: finalStart, end: finalEnd });
      void refetchDashboard();
      void refetchExpenses();
      void refetchUtilities();
    }
  };

  const expenseTotal = useMemo(() => {
    const fromApi = Number(expensesData?.totalAmount ?? 0);
    const fromDash = Number(dashboard?.summary?.expenseTotal ?? 0);
    return fromApi > 0 ? fromApi : fromDash;
  }, [expensesData?.totalAmount, dashboard?.summary?.expenseTotal]);

  const utilitiesTotal = useMemo(() => {
    return Number(dashboard?.summary?.utilitiesTotal ?? 0);
  }, [dashboard?.summary?.utilitiesTotal]);

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
    return revenueTotal - cogsTotal - expenseTotal - utilitiesTotal;
  }, [dashboard, expenseTotal, utilitiesTotal]);

  const netMargin = useMemo(() => {
    if (!dashboard?.summary || dashboard.summary.revenueTotal <= 0) return 0;
    return (netProfit / dashboard.summary.revenueTotal) * 100;
  }, [dashboard, netProfit]);

  const utilitiesList = useMemo(() => {
    return (utilitiesData?.items ?? []).filter((u) => u.active !== false);
  }, [utilitiesData?.items]);

  const expensesList = useMemo(() => {
    return expensesData?.content ?? [];
  }, [expensesData?.content]);

  const filteredExpenses = useMemo(() => {
    if (breakdownTab === "UTILITIES") return [];
    let list = expensesList;
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
  }, [expensesList, breakdownTab, expenseSearch]);

  const filteredUtilities = useMemo(() => {
    if (breakdownTab === "EXPENSES") return [];
    let list = utilitiesList;
    if (expenseSearch.trim()) {
      const q = expenseSearch.toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.payee?.toLowerCase().includes(q) ||
          u.notes?.toLowerCase().includes(q) ||
          u.incurredBy?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [utilitiesList, breakdownTab, expenseSearch]);

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
      const util = t.utilities ?? 0;
      return {
        date: t.date.slice(5),
        revenue: t.revenue,
        tax: t.tax,
        cogs: t.cogs,
        expenses: finalExp,
        utilities: util,
        netProfit: t.netProfit ?? (t.revenue - t.cogs - finalExp - util),
        sales: t.saleCount,
      };
    });
  }, [dashboard?.trend, dailyExpensesMap]);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-white">
            <TrendingUp className="h-7 w-7 text-emerald-500" />
            Revenue &amp; P&amp;L
          </h1>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading || isFetching}
            title="Refresh dashboard"
            aria-label="Refresh dashboard"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <RotateCw className={cn("h-4 w-4", (isLoading || isFetching) && "animate-spin")} />
          </button>
        </div>
      </div>

      {(orgs.length > 1 || branches.length > 1) && (
        <div className="mb-4 flex flex-wrap items-center gap-4">
          {orgs.length > 1 && (
            <div className="flex min-w-[12rem] flex-1 flex-col gap-1 sm:flex-initial">
              <label
                htmlFor="revenue-dash-org"
                className="text-xs font-semibold text-slate-500 dark:text-slate-400"
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
                className="text-xs font-semibold text-slate-500 dark:text-slate-400"
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
        </div>
      )}

      {/* Quick Range Presets */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
          Quick range:
        </span>
        {(
          [
            { key: "today", label: "Today" },
            { key: "thisWeek", label: "This Week" },
            { key: "lastWeek", label: "Last Week" },
            { key: "7days", label: "7 Days" },
            { key: "thisMonth", label: "This Month" },
            { key: "lastMonth", label: "Last Month" },
            { key: "30days", label: "30 Days" },
            { key: "thisYear", label: "This Year" },
            { key: "lastYear", label: "Last Year" },
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

      {/* Custom Date Range Inputs - only shown when custom is active */}
      {activePreset === "custom" && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Start
            </label>
            <DateInput
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              End
            </label>
            <DateInput
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
        </div>
      )}

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Total gross · <AnimatedCount value={dashboard.summary.saleCount} /> sales
                </p>
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

            {/* 3. Combined Tot exp: Expenses + Utilities */}
            <motion.div
              variants={cardVariants}
              custom={3}
              onClick={() => setShowExpenseModal(true)}
              className="group relative cursor-pointer overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-sm transition-all duration-200 hover:border-amber-400 hover:shadow-md dark:border-slate-700 dark:from-amber-950/30 dark:to-slate-800 dark:hover:border-amber-500"
              title="Click to see breakdown of expenses for this period"
            >
              <div className="p-4">
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 min-w-0">
                  <CreditCard className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-semibold truncate">
                    Tot exp:{" "}
                    <span className="font-extrabold text-amber-700 dark:text-amber-300">
                      <AnimatedNumber value={expenseTotal + utilitiesTotal} />
                    </span>
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Expense :</span>
                    <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                      <AnimatedNumber value={expenseTotal} />
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Utilities :</span>
                    <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                      <AnimatedNumber value={utilitiesTotal} />
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 4. Net profit */}
            <motion.div
              variants={cardVariants}
              custom={4}
              className={cn(
                "overflow-hidden rounded-xl border shadow-sm transition hover:shadow-md",
                netProfit >= 0
                  ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-800/60 dark:from-emerald-950/30 dark:to-slate-800"
                  : "border-rose-200 bg-gradient-to-br from-rose-50 to-white dark:border-rose-800/60 dark:from-rose-950/30 dark:to-slate-800"
              )}
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      "flex items-center gap-2",
                      netProfit >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    <CircleDollarSign className="h-5 w-5" />
                    <span className="text-sm font-medium">Net profit</span>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      netProfit >= 0
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
                    )}
                  >
                    {formatPercent(netMargin, 2)}
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                  <AnimatedNumber value={netProfit} />
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {utilitiesTotal > 0 ? "Profit - (Expenses + Utilities)" : "Profit - Expenses"}
                </p>
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

      {/* Expenses & Utilities Breakdown Modal */}
      <Modal
        open={showExpenseModal}
        onClose={() => {
          setShowExpenseModal(false);
          setExpenseSearch("");
          setBreakdownTab("ALL");
        }}
        title="Expenses & Utilities"
        maxWidth="max-w-3xl"
        scrollable
      >
        <div className="space-y-4">
          {/* Header summary context */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Selected Period
              </span>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {submittedRange?.start === submittedRange?.end
                  ? `Today (${submittedRange?.start})`
                  : `${submittedRange?.start} to ${submittedRange?.end}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
              <div>
                <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Expenses
                </span>
                <span className="font-bold text-amber-700 dark:text-amber-400">
                  {formatCurrency(expenseTotal)}
                </span>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
              <div>
                <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Utilities
                </span>
                <span className="font-bold text-indigo-700 dark:text-indigo-400">
                  {formatCurrency(utilitiesTotal)}
                </span>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
              <div>
                <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Tot exp
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatCurrency(expenseTotal + utilitiesTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Filter tabs and search bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBreakdownTab("ALL")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  breakdownTab === "ALL"
                    ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900"
                    : "border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                )}
              >
                All ({expensesList.length + utilitiesList.length})
              </button>
              <button
                type="button"
                onClick={() => setBreakdownTab("EXPENSES")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  breakdownTab === "EXPENSES"
                    ? "bg-amber-600 text-white shadow-sm dark:bg-amber-500"
                    : "border border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
                )}
              >
                Expenses ({expensesList.length})
              </button>
              <button
                type="button"
                onClick={() => setBreakdownTab("UTILITIES")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  breakdownTab === "UTILITIES"
                    ? "bg-indigo-600 text-white shadow-sm dark:bg-indigo-500"
                    : "border border-indigo-200 bg-indigo-50/70 text-indigo-900 hover:bg-indigo-100 dark:border-indigo-800/40 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
                )}
              >
                Utilities ({utilitiesList.length})
              </button>
            </div>
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                placeholder="Search expenses and utilities..."
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-8 text-xs sm:text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
          </div>

          {/* Combined Simple List */}
          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
            {filteredExpenses.length === 0 && filteredUtilities.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                <CreditCard className="mx-auto mb-2 h-8 w-8 text-slate-400 opacity-60 dark:text-slate-500" />
                <p className="font-medium">No expenses or utilities found</p>
                <p className="mt-1 text-xs text-slate-400">
                  No records match the current filter and search criteria.
                </p>
              </div>
            ) : (
              <>
                {/* Expenses */}
                {filteredExpenses.map((exp) => (
                  <div
                    key={`exp-${exp.id}`}
                    className="flex items-center justify-between py-2.5 px-3 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/40 text-sm"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 pr-3 truncate">
                      <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                        {exp.description || exp.category || "Expense"}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-amber-600 dark:text-amber-400">
                        (E)
                      </span>
                    </div>
                    <span className="shrink-0 font-bold tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(exp.amount)}
                    </span>
                  </div>
                ))}

                {/* Recurring Utilities */}
                {filteredUtilities.map((util) => (
                  <div
                    key={`util-${util.id}`}
                    className="flex items-center justify-between py-2.5 px-3 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/40 text-sm"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 pr-3 truncate">
                      <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                        {util.name}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        (U)
                      </span>
                    </div>
                    <span className="shrink-0 font-bold tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(util.amount)}(M)
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => {
                setShowExpenseModal(false);
                setExpenseSearch("");
                setBreakdownTab("ALL");
              }}
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
