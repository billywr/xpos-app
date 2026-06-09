import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import {
  fetchAdminStockCountSessions,
  fetchAdminStockCountSession,
  startAdminStockCountSession,
  deleteAdminStockCountSession,
  type StockCountSessionResponse,
} from "@/api/stockTaking";
import type { Org, Branch } from "@/types/org";
import { filterActiveOrgs, filterNonDeletedBranches } from "@/types/org";
import {
  Badge,
  Button,
  Pagination,
  ConfirmDialog,
  SortableTableHead,
  TableRowNumberHead,
  TableRowNumberCell,
  TableSearchInput,
  tableBodyRow,
  tableStickyHeadCell,
  tableHeadCell,
  tableBodyCell,
  tableStickyFirstBody,
} from "@/components/ui";
import { useDataTable } from "@/hooks/useDataTable";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { useNavVisibilityContextOrNull } from "@/contexts/NavVisibilityContext";
import { APP_NAME_KEY } from "@/config/headerNavItems";
import { downloadStockCountPdf } from "@/utils/stockCountPdf";
import { ClipboardList, Plus, Loader2, Trash2, Download } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SearchableSelect } from "@/components/SearchableSelect";

const PAGE_SIZE = 10;
const STOCK_COUNT_SESSION_SORT = {
  startedAt: (row: StockCountSessionResponse) => row.startedAt,
  sourceType: (row: StockCountSessionResponse) => row.sourceType,
  lines: (row: StockCountSessionResponse) => row.lines?.length ?? 0,
  status: (row: StockCountSessionResponse) => row.status,
};

export function StockCountSessionsPage() {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const navVisibility = useNavVisibilityContextOrNull();
  const appName = navVisibility
    ? navVisibility.getHeaderLabel(APP_NAME_KEY, "XPOS")
    : "XPOS";
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [page, setPage] = useState(0);
  const [sessionToDelete, setSessionToDelete] =
    useState<StockCountSessionResponse | null>(null);
  const [pdfLoadingSessionId, setPdfLoadingSessionId] = useState<string | null>(
    null
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

  const { data: sessionsData, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [
      "admin-stock-count-sessions",
      token,
      selectedOrgId,
      selectedBranchId,
      page,
    ],
    queryFn: () =>
      fetchAdminStockCountSessions(
        token,
        selectedOrgId,
        selectedBranchId,
        { page, size: PAGE_SIZE }
      ),
    enabled:
      Boolean(token) && Boolean(selectedOrgId) && Boolean(selectedBranchId),
  });

  const orgs = orgsData?.content ?? [];
  const branches = branchesData?.content ?? [];
  const filteredOrgs = filterActiveOrgs(orgs);
  const filteredBranches = filterNonDeletedBranches(branches);
  const sessions = sessionsData?.content ?? [];
  const {
    searchQuery,
    setSearchQuery,
    filteredRows: filteredSessions,
    sortColumn,
    sortDirection,
    toggleSort,
  } = useDataTable(sessions, undefined, {
    sortAccessors: STOCK_COUNT_SESSION_SORT,
  });
  const totalElements = sessionsData?.totalElements ?? 0;

  useEffect(() => {
    if (!selectedOrgId && filteredOrgs.length > 0) {
      setSelectedOrgId(filteredOrgs[0].id);
    }
  }, [filteredOrgs, selectedOrgId]);

  useEffect(() => {
    if (selectedOrgId && !selectedBranchId && filteredBranches.length > 0) {
      setSelectedBranchId(filteredBranches[0].id);
    }
  }, [selectedOrgId, filteredBranches, selectedBranchId]);

  const orgSelectOptions = useMemo(
    () => [
      { value: "", label: "Select organization…" },
      ...filteredOrgs.map((org: Org) => ({ value: org.id, label: org.name })),
    ],
    [filteredOrgs]
  );

  const branchSelectOptions = useMemo(
    () => [
      { value: "", label: "Select branch…" },
      ...filteredBranches.map((b: Branch) => ({ value: b.id, label: b.name })),
    ],
    [filteredBranches]
  );

  const startMutation = useMutation({
    mutationFn: () =>
      startAdminStockCountSession(token, selectedOrgId, {
        branchId: selectedBranchId,
      }),
    onSuccess: (data: StockCountSessionResponse) => {
      queryClient.invalidateQueries({
        queryKey: ["admin-stock-count-sessions"],
      });
      toast.success("Stock count session started.", { title: "Stock count" });
      navigate(
        `/admin/stock-count-sessions/${data.id}?orgId=${selectedOrgId}`
      );
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) =>
      deleteAdminStockCountSession(token, selectedOrgId, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-stock-count-sessions"],
      });
      setSessionToDelete(null);
      toast.success("Stock count session removed.", { title: "Deleted" });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    },
  });

  async function handleDownloadPdf(s: StockCountSessionResponse) {
    if (!token || !selectedOrgId) return;
    setPdfLoadingSessionId(s.id);
    try {
      const session = await fetchAdminStockCountSession(token, selectedOrgId, s.id);
      const orgName = filteredOrgs.find((o: Org) => o.id === selectedOrgId)?.name;
      const branchName = filteredBranches.find(
        (b: Branch) => b.id === selectedBranchId
      )?.name;
      downloadStockCountPdf(session, branchName, orgName, appName);
      toast.success("PDF downloaded.", { title: "Stock count" });
    } catch (err) {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    } finally {
      setPdfLoadingSessionId(null);
    }
  }

  function openSession(s: StockCountSessionResponse) {
    navigate(`/admin/stock-count-sessions/${s.id}?orgId=${selectedOrgId}`);
  }

  if (!selectedOrgId && filteredOrgs.length > 0) {
    return null;
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Manual Stock Taking"
          subtitle="Manual and scheduled stock counts. Start a session, add counted lines on the count page, then close to apply variances. Download or share PDF reports."
          icon={ClipboardList}
          fallbackTo="/admin"
          noMargin
        />
        <div className="flex flex-wrap items-center gap-4">
          <label
            htmlFor="stock-sessions-org"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Organization
          </label>
          <SearchableSelect
            id="stock-sessions-org"
            options={orgSelectOptions}
            value={selectedOrgId}
            onChange={(next) => {
              setSelectedOrgId(next);
              setSelectedBranchId("");
              setPage(0);
            }}
            placeholder="Search organization…"
            className="w-full sm:w-auto min-w-[12rem]"
            controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
          />
          <label
            htmlFor="stock-sessions-branch"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Branch
          </label>
          <SearchableSelect
            id="stock-sessions-branch"
            options={branchSelectOptions}
            value={selectedBranchId}
            onChange={(next) => {
              setSelectedBranchId(next);
              setPage(0);
            }}
            placeholder="Search branch…"
            className="w-full sm:w-auto min-w-[12rem]"
            controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
          />
          <Button
            onClick={() => startMutation.mutate()}
            disabled={
              !selectedOrgId ||
              !selectedBranchId ||
              startMutation.isPending
            }
          >
            {startMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Start count
          </Button>
        </div>
      </div>

      {(!selectedOrgId || !selectedBranchId) && selectedOrgId && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Select organization and branch to view or start sessions.
        </div>
      )}

      {selectedOrgId && selectedBranchId && isLoading && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Loading…
        </div>
      )}

      {selectedOrgId && selectedBranchId && isError && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          <p>{getApiErrorMessage(error)}</p>
        </div>
      )}

      {selectedOrgId && selectedBranchId && !isLoading && !isError && (
        <>
          <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search sessions…" className="mb-4" />
          {filteredSessions.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              {sessions.length === 0 ? "No stock count sessions yet. Start a count to begin." : "No results match your search."}
            </div>
          ) : (
            <>
              {totalElements > 0 && (
                <Pagination
                  position="top"
                  page={page}
                  size={PAGE_SIZE}
                  totalElements={totalElements}
                  onPageChange={setPage}
                  onRefresh={() => void refetch()}
                  isRefreshing={isFetching}
                />
              )}
              <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">← swipe table to see all columns →</p>
              <div className="relative min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
                <table className="w-full divide-y divide-slate-200 dark:divide-slate-600" style={{ minWidth: "600px" }}>
                  <thead className="bg-slate-50 dark:bg-slate-700">
                    <tr className="bg-slate-50 dark:bg-slate-700/50">
                      <TableRowNumberHead />
                      <SortableTableHead
                        columnKey="startedAt"
                        label="Started"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={toggleSort}
                        className={`${tableStickyHeadCell} ${tableHeadCell}`}
                      />
                      <SortableTableHead
                        columnKey="sourceType"
                        label="Source"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={toggleSort}
                        className={tableHeadCell}
                      />
                      <SortableTableHead
                        columnKey="lines"
                        label="Lines"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={toggleSort}
                        className={tableHeadCell}
                      />
                      <SortableTableHead
                        columnKey="status"
                        label="Status"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={toggleSort}
                        className={tableHeadCell}
                      />
                      <SortableTableHead
                        columnKey="actions"
                        label="Actions"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={toggleSort}
                        sortable={false}
                        className={tableHeadCell}
                      />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                    {filteredSessions.map((s, index) => (
                      <tr
                        key={s.id}
                        className={tableBodyRow}
                      >
                    <TableRowNumberCell page={page} pageSize={PAGE_SIZE} indexInPage={index} />
                        <td className={tableStickyFirstBody}>
                          {new Date(s.startedAt).toLocaleString("en-GB")}
                        </td>
                        <td className={tableBodyCell}>
                          {s.sourceType}
                        </td>
                        <td className={tableBodyCell}>
                          {s.lines?.length ?? 0}
                        </td>
                        <td className={tableBodyCell}>
                          <Badge status={s.status}>{s.status}</Badge>
                        </td>
                        <td className={tableBodyCell}>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openSession(s)}
                              className="rounded-lg px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadPdf(s)}
                              disabled={pdfLoadingSessionId === s.id}
                              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-600 disabled:opacity-50"
                              aria-label="Download PDF report"
                            >
                              {pdfLoadingSessionId === s.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                              PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => setSessionToDelete(s)}
                              disabled={deleteMutation.isPending}
                              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-600 disabled:opacity-50"
                              aria-label="Delete session"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ConfirmDialog
                open={sessionToDelete !== null}
                onClose={() => setSessionToDelete(null)}
                onConfirm={() => {
                  if (sessionToDelete) deleteMutation.mutate(sessionToDelete.id);
                }}
                title="Delete this stock count session?"
                message={
                  sessionToDelete
                    ? `Remove session from ${new Date(
                        sessionToDelete.startedAt
                      ).toLocaleString()}? This cannot be undone.`
                    : ""
                }
                confirmLabel="Delete"
                variant="danger"
                loading={deleteMutation.isPending}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
