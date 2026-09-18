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
import {
  Badge,
  Pagination,
  SortableTableHead,
  TableRowNumberHead,
  TableRowNumberCell,
  TableSearchInput,
  TableSkeleton,
  tableBodyRow,
  tableStickyHeadCell,
  tableHeadCell,
  tableBodyCell,
  tableBodyCellNum,
  tableStickyFirstBody,
  tableEmptyCell,
} from "@/components/ui";
import { useQueryDisplay } from "@/hooks/useQueryDisplay";
import { useServerPaginatedTableSearch } from "@/hooks/useServerPaginatedTableSearch";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { formatAmount } from "@/utils/formatCurrency";
import { Wallet } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export function ShiftsListPage() {
  const SHIFT_SORT = {
    openedAt: (row: Shift) => row.openedAt,
    closedAt: (row: Shift) => row.closedAt ?? "",
    status: (row: Shift) => row.status,
    openingFloatAmount: (row: Shift) => row.openingFloatAmount,
    closingCountedAmount: (row: Shift) => row.closingCountedAmount ?? Number.NEGATIVE_INFINITY,
    varianceAmount: (row: Shift) => row.varianceAmount ?? Number.NEGATIVE_INFINITY,
  };

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

  const shiftsQuery = useQuery({
    queryKey: ["admin-shifts", token, selectedOrgId, selectedBranchId, page, size],
    queryFn: () =>
      fetchShifts(token, selectedOrgId, selectedBranchId, { page, size }),
    enabled: Boolean(token) && Boolean(selectedOrgId) && Boolean(selectedBranchId),
  });
  const { data: shiftsData, isError, error, refetch } = shiftsQuery;
  const { isInitialLoad, isRefreshing } = useQueryDisplay(shiftsQuery);

  const orgs = filterActiveOrgs(orgsData?.content ?? []);
  const branches = filterNonDeletedBranches(branchesData?.content ?? []);
  const shifts = shiftsData?.content ?? [];
  const {
    searchQuery,
    setSearchQuery,
    filteredRows: filteredShifts,
    totalElements,
    sortColumn,
    sortDirection,
    toggleSort,
  } = useServerPaginatedTableSearch({
    pageRows: shifts,
    serverTotalElements: shiftsData?.totalElements ?? 0,
    page,
    size,
    setPage,
    searchAllQueryKey: ["admin-shifts", token, selectedOrgId, selectedBranchId],
    searchAllQueryFn: (fetchSize) =>
      fetchShifts(token, selectedOrgId, selectedBranchId, { page: 0, size: fetchSize }),
    searchAllEnabled:
      Boolean(token) && Boolean(selectedOrgId) && Boolean(selectedBranchId),
    sortAccessors: SHIFT_SORT,
  });

  const showClosedCol = useMemo(
    () => filteredShifts.some((s: Shift) => !!s.closedAt),
    [filteredShifts]
  );
  const showCountedCol = useMemo(
    () => filteredShifts.some((s: Shift) => s.closingCountedAmount != null),
    [filteredShifts]
  );
  const showVarianceCol = useMemo(
    () => filteredShifts.some((s: Shift) => s.varianceAmount != null),
    [filteredShifts]
  );
  const visibleShiftsColCount =
    4 +
    (showClosedCol ? 1 : 0) +
    (showCountedCol ? 1 : 0) +
    (showVarianceCol ? 1 : 0);

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

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <PageHeader
        title="Shifts"
        subtitle="View shift history by branch. Select org and branch to list shifts."
        icon={Wallet}
        fallbackTo="/admin"
      />

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
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
            className="w-full sm:w-56"
            controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
          />
        </div>
        <div className="flex flex-col gap-1">
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
            className="w-full sm:w-56"
            controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
          />
        </div>
      </div>

      {!selectedOrgId || !selectedBranchId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization and branch to view shifts.
        </div>
      ) : (
        <>
          {isError && (
            <div
              className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
              role="alert"
            >
              <p>{getApiErrorMessage(error)}</p>
              {getApiErrorRequestId(error) && (
                <p className="mt-2 text-sm opacity-90">
                  Reference:{" "}
                  <code className="rounded bg-red-100 px-1 dark:bg-red-900/50">
                    {getApiErrorRequestId(error)}
                  </code>
                </p>
              )}
            </div>
          )}
          <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search shifts…" className="mb-4" />
          <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">← swipe table to see all columns →</p>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="relative min-h-0 flex-1 overflow-auto">
              <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
              <table className="w-full divide-y divide-slate-200 dark:divide-slate-700" style={{ minWidth: "720px" }}>
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <TableRowNumberHead />
                    <SortableTableHead
                      align="right"
                      columnKey="openedAt"
                      label="Opened"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={`${tableStickyHeadCell} ${tableHeadCell}`}
                    />
                    {showClosedCol && (
                      <SortableTableHead
                      align="right"
                        columnKey="closedAt"
                        label="Closed"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={toggleSort}
                        className={tableHeadCell}
                      />
                    )}
                    <SortableTableHead
                      columnKey="status"
                      label="Status"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
                    <SortableTableHead
                      align="right"
                      columnKey="openingFloatAmount"
                      label="Float (KSH)"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
                    {showCountedCol && (
                      <SortableTableHead
                      align="right"
                        columnKey="closingCountedAmount"
                        label="Counted (KSH)"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={toggleSort}
                        className={tableHeadCell}
                      />
                    )}
                    {showVarianceCol && (
                      <SortableTableHead
                      align="right"
                        columnKey="varianceAmount"
                        label="Variance (KSH)"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={toggleSort}
                        className={tableHeadCell}
                      />
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {isInitialLoad ? (
                    <TableSkeleton columns={7} />
                  ) : filteredShifts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleShiftsColCount}
                        className={tableEmptyCell}
                      >
                        {shifts.length === 0 ? `No shifts for ${selectedBranch?.name ?? "this branch"}.` : "No results match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredShifts.map((shift: Shift, index) => (
                      <tr
                        key={shift.id}
                        className={tableBodyRow}
                      >
                    <TableRowNumberCell page={page} pageSize={size} indexInPage={index} />
                        <td className={tableStickyFirstBody}>
                          {new Date(shift.openedAt).toLocaleString()}
                        </td>
                        {showClosedCol && (
                          <td className={tableBodyCell}>
                            {shift.closedAt
                              ? new Date(shift.closedAt).toLocaleString()
                              : "—"}
                          </td>
                        )}
                        <td className={tableBodyCell}>
                          <Badge status={shift.status}>{shift.status}</Badge>
                        </td>
                        <td className={tableBodyCellNum}>
                          {formatAmount(shift.openingFloatAmount)}
                        </td>
                        {showCountedCol && (
                          <td className={tableBodyCellNum}>
                            {shift.closingCountedAmount != null
                              ? formatAmount(shift.closingCountedAmount)
                              : "—"}
                          </td>
                        )}
                        {showVarianceCol && (
                          <td className={tableBodyCellNum}>
                            {shift.varianceAmount != null
                              ? formatAmount(shift.varianceAmount)
                              : "—"}
                          </td>
                        )}
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
                onRefresh={() => void refetch()}
                isRefreshing={isRefreshing}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
