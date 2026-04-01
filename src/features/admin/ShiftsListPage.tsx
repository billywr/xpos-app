import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import { fetchShifts } from "@/api/adminShifts";
import type { Org, Branch } from "@/types/org";
import { filterActiveOrgs, filterNonDeletedBranches } from "@/types/org";
import type { Shift } from "@/types/shift";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/ui";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { formatCurrency } from "@/utils/formatCurrency";
import { Wallet } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export function ShiftsListPage() {
  const token = useAppSelector(selectToken);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);

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

  const { data: shiftsData, isLoading, isError, error } = useQuery({
    queryKey: ["admin-shifts", token, selectedOrgId, selectedBranchId, page, size],
    queryFn: () =>
      fetchShifts(token, selectedOrgId, selectedBranchId, { page, size }),
    enabled: Boolean(token) && Boolean(selectedOrgId) && Boolean(selectedBranchId),
  });

  const orgs = filterActiveOrgs(orgsData?.content ?? []);
  const branches = filterNonDeletedBranches(branchesData?.content ?? []);
  const shifts = shiftsData?.content ?? [];
  const totalElements = shiftsData?.totalElements ?? 0;

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

  if (isLoading && selectedOrgId && selectedBranchId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <PageHeader
          title="Shifts"
          subtitle="Loading…"
          icon={Wallet}
          fallbackTo="/admin"
        />
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
        <PageHeader
          title="Shifts"
          icon={Wallet}
          fallbackTo="/admin"
        />
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
      <PageHeader
        title="Shifts"
        subtitle="View shift history by branch. Select org and branch to list shifts."
        icon={Wallet}
        fallbackTo="/admin"
      />

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label
          htmlFor="shifts-org-select"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Organization
        </label>
        <SearchableSelect
          id="shifts-org-select"
          options={orgSelectOptions}
          value={selectedOrgId}
          onChange={(next) => {
            setSelectedOrgId(next);
            setSelectedBranchId("");
            setPage(0);
          }}
          placeholder="Search organization…"
          className="min-w-[12rem]"
          controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
        />
        <label
          htmlFor="shifts-branch-select"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Branch
        </label>
        <SearchableSelect
          id="shifts-branch-select"
          options={branchSelectOptions}
          value={selectedBranchId}
          onChange={(next) => {
            setSelectedBranchId(next);
            setPage(0);
          }}
          placeholder="Search branch…"
          className="min-w-[12rem]"
          controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
        />
      </div>

      {!selectedOrgId || !selectedBranchId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization and branch to view shifts.
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Opened at
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Closed at
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Opening float
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Closing counted
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Variance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {shifts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        No shifts for {selectedBranch?.name ?? "this branch"}.
                      </td>
                    </tr>
                  ) : (
                    shifts.map((shift: Shift) => (
                      <tr
                        key={shift.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-4 py-3 text-slate-800 dark:text-white">
                          {new Date(shift.openedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {shift.closedAt
                            ? new Date(shift.closedAt).toLocaleString()
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex justify-start rounded-full px-2 py-0.5 text-left text-xs font-medium ${
                              shift.status === "OPEN"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {shift.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-left tabular-nums text-slate-800 dark:text-white">
                          {formatCurrency(shift.openingFloatAmount)}
                        </td>
                        <td className="px-4 py-3 text-left tabular-nums text-slate-600 dark:text-slate-300">
                          {shift.closingCountedAmount != null
                            ? formatCurrency(shift.closingCountedAmount)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-left tabular-nums text-slate-600 dark:text-slate-300">
                          {shift.varianceAmount != null
                            ? formatCurrency(shift.varianceAmount)
                            : "—"}
                        </td>
                      </tr>
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
