import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import {
  selectOrgId,
  selectBranchId,
  selectBranchName,
  selectOrgName,
} from "@/store/selectors/orgContextSelectors";
import {
  fetchOperatorStockCountSessions,
  fetchOperatorStockCountSession,
  startOperatorStockCountSession,
  deleteOperatorStockCountSession,
  type StockCountSessionResponse,
} from "@/api/stockTaking";
import { Pagination, ConfirmDialog, TableSearchInput } from "@/components/ui";
import { useTableSearch } from "@/hooks/useTableSearch";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { useNavVisibilityContextOrNull } from "@/contexts/NavVisibilityContext";
import { APP_NAME_KEY } from "@/config/headerNavItems";
import { downloadStockCountPdf } from "@/utils/stockCountPdf";
import { ClipboardList, Plus, Loader2, Trash2, Download } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

const PAGE_SIZE = 10;

export function StockCountPage() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId) ?? "";
  const branchId = useAppSelector(selectBranchId) ?? "";
  const branchName = useAppSelector(selectBranchName);
  const orgName = useAppSelector(selectOrgName);
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const navVisibility = useNavVisibilityContextOrNull();
  const appName = navVisibility
    ? navVisibility.getHeaderLabel(APP_NAME_KEY, "XPOS")
    : "XPOS";
  const [page, setPage] = useState(0);
  const [sessionToDelete, setSessionToDelete] =
    useState<StockCountSessionResponse | null>(null);
  const [pdfLoadingSessionId, setPdfLoadingSessionId] = useState<string | null>(
    null
  );

  const { data: sessionsData, isLoading, isError, error } = useQuery({
    queryKey: [
      "operator-stock-count-sessions",
      token,
      orgId,
      branchId,
      page,
    ],
    queryFn: () =>
      fetchOperatorStockCountSessions(token, orgId, branchId, {
        page,
        size: PAGE_SIZE,
      }),
    enabled: Boolean(token && orgId && branchId),
  });

  const sessions = sessionsData?.content ?? [];
  const { searchQuery, setSearchQuery, filteredRows: filteredSessions } = useTableSearch(sessions);
  const totalElements = sessionsData?.totalElements ?? 0;
  const totalPages = sessionsData?.totalPages ?? 0;

  const startMutation = useMutation({
    mutationFn: () => startOperatorStockCountSession(token, orgId, branchId),
    onSuccess: (data: StockCountSessionResponse) => {
      queryClient.invalidateQueries({
        queryKey: ["operator-stock-count-sessions"],
      });
      toast.success("Stock count session started.", { title: "Stock count" });
      navigate(`/operator/stock-count/${data.id}`);
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
      deleteOperatorStockCountSession(token, orgId, branchId, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["operator-stock-count-sessions"],
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
    if (!token || !orgId || !branchId) return;
    setPdfLoadingSessionId(s.id);
    try {
      const session = await fetchOperatorStockCountSession(
        token,
        orgId,
        branchId,
        s.id
      );
      downloadStockCountPdf(
        session,
        branchName ?? undefined,
        orgName ?? undefined,
        appName
      );
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
    navigate(`/operator/stock-count/${s.id}`);
  }

  if (!orgId || !branchId) {
    return (
      <div className="p-6">
        <p className="text-slate-600 dark:text-slate-400">
          Select organization and branch context to perform stock counts.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Manual Stock Taking"
          subtitle={`Stock counts at ${branchName ?? "this branch"}. Start a session, add counted quantities on the count page, then close to apply variances.`}
          icon={ClipboardList}
          fallbackTo="/operator"
          noMargin
        />
        <button
          type="button"
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {startMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Start count
        </button>
      </div>

      {isLoading && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Loading…
        </div>
      )}

      {isError && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          <p>{getApiErrorMessage(error)}</p>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search sessions…" className="mb-4" />
          {filteredSessions.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              {sessions.length === 0 ? "No stock count sessions yet. Start a count to begin." : "No results match your search."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-600">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Started
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Source
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Lines
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                    {filteredSessions.map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                          {new Date(s.startedAt).toLocaleString("en-GB")}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                          {s.sourceType}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                          {s.lines?.length ?? 0}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex justify-start rounded-full px-2 py-1 text-left text-xs font-medium ${
                              s.status === "OPEN"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-left">
                          <div className="flex items-center gap-2">
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
              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination
                    page={page}
                    size={PAGE_SIZE}
                    totalElements={totalElements}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

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
    </div>
  );
}
