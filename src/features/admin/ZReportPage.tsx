import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import { fetchZReport } from "@/api/zReport";
import type { Org, Branch } from "@/types/org";
import { filterActiveOrgs, filterNonDeletedBranches } from "@/types/org";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { formatCurrency } from "@/utils/formatCurrency";
import { FileText } from "lucide-react";

export function ZReportPage() {
  const token = useAppSelector(selectToken);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [businessDate, setBusinessDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

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

  const { data: report, isLoading, isError, error } = useQuery({
    queryKey: ["admin-z-report", token, selectedOrgId, selectedBranchId, businessDate],
    queryFn: () =>
      fetchZReport(token, selectedOrgId, selectedBranchId, businessDate),
    enabled:
      Boolean(token) &&
      Boolean(selectedOrgId) &&
      Boolean(selectedBranchId) &&
      Boolean(businessDate.trim()),
  });

  const orgs = filterActiveOrgs(orgsData?.content ?? []);
  const branches = filterNonDeletedBranches(branchesData?.content ?? []);
  const selectedBranch = branches.find((b: Branch) => b.id === selectedBranchId);

  useEffect(() => {
    if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [orgs, selectedOrgId]);

  useEffect(() => {
    if (selectedOrgId && !selectedBranchId && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [selectedOrgId, branches, selectedBranchId]);

  if (isError && selectedOrgId && selectedBranchId && businessDate.trim()) {
    const message = getApiErrorMessage(error);
    const requestId = getApiErrorRequestId(error);
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <h1 className="mb-6 text-2xl font-bold text-slate-800 dark:text-white">
          Z-Report
        </h1>
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          <p>{message}</p>
          {requestId && (
            <p className="mt-2 text-sm opacity-90">
              Reference: <code className="rounded bg-red-100 px-1 dark:bg-red-900/50">{requestId}</code>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-white">
            <FileText className="h-7 w-7" />
            Z-Report
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            End-of-day sales summary by branch and business date.
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <label
          htmlFor="zreport-org-select"
          className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Organization
        </label>
        <select
          id="zreport-org-select"
          value={selectedOrgId}
          onChange={(e) => {
            setSelectedOrgId(e.target.value);
            setSelectedBranchId("");
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        >
          <option value="">Select organization…</option>
          {orgs.map((org: Org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        <label
          htmlFor="zreport-branch-select"
          className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Branch
        </label>
        <select
          id="zreport-branch-select"
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        >
          <option value="">Select branch…</option>
          {branches.map((branch: Branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
        <label
          htmlFor="zreport-date"
          className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Business date
        </label>
        <input
          id="zreport-date"
          type="date"
          value={businessDate}
          onChange={(e) => setBusinessDate(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        />
      </div>

      {!selectedOrgId || !selectedBranchId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select organization and branch to view the report.
        </div>
      ) : isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
          Loading report…
        </div>
      ) : report ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-600 dark:bg-slate-800/80">
            <h2 className="font-semibold text-slate-800 dark:text-white">
              Z-Report · {selectedBranch?.name ?? "Branch"} · {report.businessDate}
            </h2>
          </div>
          <dl className="grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex justify-between gap-4 bg-slate-50/50 px-4 py-3 dark:bg-slate-800/50">
              <dt className="text-slate-600 dark:text-slate-400">Sales total</dt>
              <dd className="tabular-nums font-medium text-slate-900 dark:text-white">
                {formatCurrency(report.salesTotal)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 bg-slate-50/50 px-4 py-3 dark:bg-slate-800/50">
              <dt className="text-slate-600 dark:text-slate-400">Tax total</dt>
              <dd className="tabular-nums font-medium text-slate-900 dark:text-white">
                {formatCurrency(report.taxTotal)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 bg-slate-50/50 px-4 py-3 dark:bg-slate-800/50">
              <dt className="text-slate-600 dark:text-slate-400">Cash total</dt>
              <dd className="tabular-nums font-medium text-slate-900 dark:text-white">
                {formatCurrency(report.cashTotal)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 bg-slate-50/50 px-4 py-3 dark:bg-slate-800/50">
              <dt className="text-slate-600 dark:text-slate-400">M-Pesa total</dt>
              <dd className="tabular-nums font-medium text-slate-900 dark:text-white">
                {formatCurrency(report.mpesaTotal)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 bg-slate-50/50 px-4 py-3 dark:bg-slate-800/50">
              <dt className="text-slate-600 dark:text-slate-400">Card total</dt>
              <dd className="tabular-nums font-medium text-slate-900 dark:text-white">
                {formatCurrency(report.cardTotal)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 bg-slate-50/50 px-4 py-3 dark:bg-slate-800/50">
              <dt className="text-slate-600 dark:text-slate-400">Other tender</dt>
              <dd className="tabular-nums font-medium text-slate-900 dark:text-white">
                {formatCurrency(report.otherTenderTotal)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 bg-slate-50/50 px-4 py-3 dark:bg-slate-800/50">
              <dt className="text-slate-600 dark:text-slate-400">Variance total</dt>
              <dd className="tabular-nums font-medium text-slate-900 dark:text-white">
                {formatCurrency(report.varianceTotal)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 bg-slate-50/50 px-4 py-3 dark:bg-slate-800/50">
              <dt className="text-slate-600 dark:text-slate-400">Sale count</dt>
              <dd className="tabular-nums font-medium text-slate-900 dark:text-white">
                {report.saleCount}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
