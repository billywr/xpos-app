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
import type { Org, Branch } from "@/types/org";
import { filterActiveOrgs, filterNonDeletedBranches } from "@/types/org";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatCurrency } from "@/utils/formatCurrency";
import { TrendingUp, DollarSign, Receipt, Percent, Package, CircleDollarSign } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { DateInput } from "@/components/ui";

function useDateRange(days = 30) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
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
  const token = useAppSelector(selectToken);
  const defaultRange = useDateRange(30);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [submittedRange, setSubmittedRange] = useState<{
    start: string;
    end: string;
  } | null>(null);

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

  const handleLoad = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrgId && selectedBranchId && startDate && endDate) {
      setSubmittedRange({ start: startDate, end: endDate });
    }
  };

  const netProfit = useMemo(() => {
    if (!dashboard?.summary) return 0;
    const { revenueTotal, cogsTotal } = dashboard.summary;
    return revenueTotal - cogsTotal;
  }, [dashboard]);

  const chartData = useMemo(() => {
    return (dashboard?.trend ?? []).map((t) => ({
      date: t.date.slice(5),
      revenue: t.revenue,
      tax: t.tax,
      sales: t.saleCount,
    }));
  }, [dashboard?.trend]);

  if (isError && selectedOrgId && selectedBranchId && submittedRange) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <h1 className="mb-6 text-2xl font-bold text-slate-800 dark:text-white">
          Revenue & P&amp;L
        </h1>
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          <p>{getApiErrorMessage(error)}</p>
        </div>
      </div>
    );
  }

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

      <form onSubmit={handleLoad} className="mb-6 flex flex-wrap items-end gap-4">
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
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-initial">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Start date
          </label>
          <DateInput
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setSubmittedRange(null);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-initial">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            End date
          </label>
          <DateInput
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setSubmittedRange(null);
            }}
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
      ) : dashboard ? (
        <motion.div
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
              </div>
            </motion.div>
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
              </div>
            </motion.div>
            <motion.div
              variants={cardVariants}
              custom={2}
              className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-violet-50 to-white shadow-sm transition hover:shadow-md dark:border-slate-700 dark:from-violet-950/30 dark:to-slate-800"
            >
              <div className="p-4">
                <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                  <CircleDollarSign className="h-5 w-5" />
                  <span className="text-sm font-medium">Net profit</span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                  <AnimatedNumber value={netProfit} />
                </p>
              </div>
            </motion.div>
            <motion.div
              variants={cardVariants}
              custom={3}
              className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-amber-50 to-white shadow-sm transition hover:shadow-md dark:border-slate-700 dark:from-amber-950/30 dark:to-slate-800"
            >
              <div className="p-4">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Percent className="h-5 w-5" />
                  <span className="text-sm font-medium">Tax</span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                  <AnimatedNumber value={dashboard.summary.taxTotal} />
                </p>
              </div>
            </motion.div>
            <motion.div
              variants={cardVariants}
              custom={4}
              className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-blue-50 to-white shadow-sm transition hover:shadow-md dark:border-slate-700 dark:from-blue-950/30 dark:to-slate-800"
            >
              <div className="p-4">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Receipt className="h-5 w-5" />
                  <span className="text-sm font-medium">Sales</span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                  <AnimatedCount value={dashboard.summary.saleCount} />
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
    </div>
  );
}
