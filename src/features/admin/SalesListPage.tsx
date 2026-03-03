import { Fragment, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import {
  fetchAdminSales,
  type SaleSummary,
  type FetchAdminSalesParams,
} from "@/api/adminSales";
import { fetchReceiptDetails } from "@/api/sales";
import type { Org, Branch } from "@/types/org";
import { filterActiveOrgs, filterNonDeletedBranches } from "@/types/org";
import { Pagination } from "@/components/ui";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { formatCurrency } from "@/utils/formatCurrency";
import { Receipt, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function SalesListPage() {
  const token = useAppSelector(selectToken);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const [fromDate, setFromDate] = useState<string>(toDateStr(defaultFrom));
  const [toDate, setToDate] = useState<string>(toDateStr(today));
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

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

  const params: FetchAdminSalesParams = {
    page,
    size,
    status: "COMPLETED",
    fromDate,
    toDate,
  };

  const { data: salesData, isLoading, isError, error } = useQuery({
    queryKey: ["admin-sales", token, selectedOrgId, selectedBranchId, params],
    queryFn: () =>
      fetchAdminSales(token, selectedOrgId, selectedBranchId, params),
    enabled: Boolean(token) && Boolean(selectedOrgId) && Boolean(selectedBranchId),
  });

  const sales = salesData?.content ?? [];
  const expandedSale = sales.find((s: SaleSummary) => s.id === expandedSaleId);
  const { data: receiptDetails, isLoading: receiptLoading } = useQuery({
    queryKey: [
      "receipt-details",
      token,
      selectedOrgId,
      selectedBranchId,
      expandedSale?.terminalId,
      expandedSaleId,
    ],
    queryFn: () =>
      fetchReceiptDetails(
        token,
        selectedOrgId!,
        selectedBranchId!,
        expandedSale!.terminalId,
        expandedSaleId!
      ),
    enabled:
      Boolean(token) &&
      Boolean(selectedOrgId) &&
      Boolean(selectedBranchId) &&
      Boolean(expandedSaleId) &&
      Boolean(expandedSale?.terminalId),
  });

  const orgs = filterActiveOrgs(orgsData?.content ?? []);
  const branches = filterNonDeletedBranches(branchesData?.content ?? []);
  const totalElements = salesData?.totalElements ?? 0;

  const handleSizeChange = (newSize: number) => {
    setSize(Math.min(newSize, MAX_PAGE_SIZE));
    setPage(0);
  };

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

  if (isLoading && selectedOrgId && selectedBranchId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <h1 className="mb-6 text-2xl font-bold text-slate-800 dark:text-white">
          Sales
        </h1>
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Loading…
        </div>
      </div>
    );
  }

  if (isError && selectedOrgId && selectedBranchId) {
    const message = getApiErrorMessage(error);
    const requestId = getApiErrorRequestId(error);
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <h1 className="mb-6 text-2xl font-bold text-slate-800 dark:text-white">
          Sales
        </h1>
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          <p>{message}</p>
          {requestId && (
            <p className="mt-2 text-sm opacity-90">
              Reference:{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-900/50">
                {requestId}
              </code>
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
            <Receipt className="h-7 w-7" />
            Sales
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            View completed sales by branch. Select org, branch, and date range.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label
          htmlFor="sales-org-select"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Organization
        </label>
        <select
          id="sales-org-select"
          value={selectedOrgId}
          onChange={(e) => {
            setSelectedOrgId(e.target.value);
            setSelectedBranchId("");
            setPage(0);
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
          htmlFor="sales-branch-select"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Branch
        </label>
        <select
          id="sales-branch-select"
          value={selectedBranchId}
          onChange={(e) => {
            setSelectedBranchId(e.target.value);
            setPage(0);
          }}
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
          htmlFor="sales-from-date"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          From
        </label>
        <input
          id="sales-from-date"
          type="date"
          value={fromDate}
          onChange={(e) => {
            setFromDate(e.target.value);
            setPage(0);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        />
        <label
          htmlFor="sales-to-date"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          To
        </label>
        <input
          id="sales-to-date"
          type="date"
          value={toDate}
          onChange={(e) => {
            setToDate(e.target.value);
            setPage(0);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        />
      </div>

      {!selectedOrgId || !selectedBranchId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization and branch to view sales.
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <th className="w-10 px-2 py-3" aria-label="Expand" />
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Receipt #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Completed at
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Cashier
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {sales.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        No completed sales for {selectedBranch?.name ?? "this branch"} in the
                        selected date range.
                      </td>
                    </tr>
                  ) : (
                    sales.map((sale: SaleSummary) => (
                      <Fragment key={sale.id}>
                        <tr
                          key={sale.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                        >
                          <td className="w-10 px-2 py-3">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedSaleId(
                                  expandedSaleId === sale.id ? null : sale.id
                                )
                              }
                              className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-slate-200"
                              aria-label={
                                expandedSaleId === sale.id
                                  ? "Collapse items"
                                  : "Expand items"
                              }
                            >
                              {expandedSaleId === sale.id ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-800 dark:text-white">
                            {sale.receiptNumber ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-800 dark:text-white">
                            {sale.completedAt
                              ? new Date(sale.completedAt).toLocaleString()
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                            {sale.createdByUsername ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-left tabular-nums font-medium text-slate-800 dark:text-white">
                            {formatCurrency(sale.total)}
                          </td>
                        </tr>
                        {expandedSaleId === sale.id && (
                          <tr key={`${sale.id}-expanded`}>
                            <td
                              colSpan={5}
                              className="bg-slate-50 px-4 py-3 dark:bg-slate-800/50"
                            >
                              {receiptLoading ? (
                                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Loading items…
                                </div>
                              ) : receiptDetails?.lines && receiptDetails.lines.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="min-w-[200px] text-sm">
                                    <thead>
                                      <tr className="border-b border-slate-200 dark:border-slate-600">
                                        <th className="pb-2 pr-4 text-left font-medium text-slate-600 dark:text-slate-400">
                                          Item
                                        </th>
                                        <th className="pb-2 text-left font-medium text-slate-600 dark:text-slate-400">
                                          Qty
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {receiptDetails.lines.map((line) => (
                                        <tr
                                          key={line.id}
                                          className="border-b border-slate-100 dark:border-slate-700/50"
                                        >
                                          <td className="py-1.5 pr-4 text-slate-800 dark:text-white">
                                            {line.itemName}
                                          </td>
                                          <td className="py-1.5 text-left tabular-nums text-slate-600 dark:text-slate-300">
                                            {line.qty}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                  No line items
                                </p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalElements > 0 && (
              <Pagination
                page={page}
                size={size}
                totalElements={totalElements}
                onPageChange={setPage}
                onSizeChange={handleSizeChange}
                sizeOptions={[10, 25, 50, 100]}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
