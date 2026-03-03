import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import {
  selectOrgId,
  selectBranchId,
  selectBranchName,
} from "@/store/selectors/orgContextSelectors";
import { fetchItems } from "@/api/items";
import {
  fetchOperatorStockCountSessions,
  startOperatorStockCountSession,
  fetchOperatorStockCountSession,
  addOperatorStockCountLine,
  closeOperatorStockCountSession,
  type StockCountSessionResponse,
  type StockCountLineResponse,
} from "@/api/stockTaking";
import type { Item } from "@/types/catalog";
import { SlideOver, Pagination } from "@/components/ui";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { ClipboardList, Plus, Loader2, Check } from "lucide-react";

const PAGE_SIZE = 10;

function formatVariance(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v}`;
}

export function StockCountPage() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId) ?? "";
  const branchId = useAppSelector(selectBranchId) ?? "";
  const branchName = useAppSelector(selectBranchName);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(0);
  const [slideOpen, setSlideOpen] = useState(false);
  const [viewingSession, setViewingSession] =
    useState<StockCountSessionResponse | null>(null);
  const [addLineItemId, setAddLineItemId] = useState("");
  const [addLineQty, setAddLineQty] = useState("");
  const [addLineSubmitting, setAddLineSubmitting] = useState(false);
  const [closeSubmitting, setCloseSubmitting] = useState(false);

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

  const { data: itemsData } = useQuery({
    queryKey: ["items", token, orgId],
    queryFn: () => fetchItems(token, orgId, { size: 500 }),
    enabled: Boolean(token) && Boolean(orgId) && slideOpen,
  });

  const sessions = sessionsData?.content ?? [];
  const totalElements = sessionsData?.totalElements ?? 0;
  const totalPages = sessionsData?.totalPages ?? 0;
  const items = itemsData?.content ?? [];
  const trackedItems = items.filter((i: Item) => i.trackInventory);

  const startMutation = useMutation({
    mutationFn: () => startOperatorStockCountSession(token, orgId, branchId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["operator-stock-count-sessions"],
      });
      setViewingSession(data);
      setSlideOpen(true);
      toast.success("Stock count session started.", { title: "Stock count" });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    },
  });

  async function handleAddLine() {
    if (!viewingSession || !addLineItemId || !addLineQty) return;
    const qty = parseFloat(addLineQty);
    if (isNaN(qty) || qty < 0) {
      toast.error("Enter a valid non-negative quantity.", { title: "Validation" });
      return;
    }
    setAddLineSubmitting(true);
    try {
      const updated = await addOperatorStockCountLine(
        token,
        orgId,
        branchId,
        viewingSession.id,
        { itemId: addLineItemId, countedQty: qty }
      );
      setViewingSession(updated);
      setAddLineItemId("");
      setAddLineQty("");
      queryClient.invalidateQueries({
        queryKey: ["operator-stock-count-sessions"],
      });
      toast.success("Count line added.", { title: "Stock count" });
    } catch (err) {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    } finally {
      setAddLineSubmitting(false);
    }
  }

  async function handleClose() {
    if (!viewingSession) return;
    setCloseSubmitting(true);
    try {
      await closeOperatorStockCountSession(
        token,
        orgId,
        branchId,
        viewingSession.id
      );
      setSlideOpen(false);
      setViewingSession(null);
      queryClient.invalidateQueries({
        queryKey: ["operator-stock-count-sessions"],
      });
      queryClient.invalidateQueries({ queryKey: ["stockLevels"] });
      toast.success("Session closed. Stock adjusted.", { title: "Stock count" });
    } catch (err) {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    } finally {
      setCloseSubmitting(false);
    }
  }

  function openSession(s: StockCountSessionResponse) {
    setViewingSession(s);
    setSlideOpen(true);
  }

  function refreshSession() {
    if (!viewingSession) return;
    fetchOperatorStockCountSession(token, orgId, branchId, viewingSession.id)
      .then(setViewingSession)
      .catch(() => {});
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
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-white">
            <ClipboardList className="h-7 w-7" />
            Stock Count
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Manual stock counts at {branchName ?? "this branch"}. Start a session,
            add counted quantities, then close to apply variances.
          </p>
        </div>
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
          {sessions.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              No stock count sessions yet. Start a count to begin.
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
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-700 dark:text-slate-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                    {sessions.map((s) => (
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
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                              s.status === "OPEN"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openSession(s)}
                            className="rounded-lg px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                          >
                            View
                          </button>
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

      <SlideOver
        open={slideOpen}
        onClose={() => {
          setSlideOpen(false);
          setViewingSession(null);
          setAddLineItemId("");
          setAddLineQty("");
        }}
        title={
          viewingSession
            ? `Stock count ${viewingSession.status === "OPEN" ? "(open)" : "(closed)"}`
            : "Stock count"
        }
      >
        {viewingSession && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Started{" "}
              {new Date(viewingSession.startedAt).toLocaleString("en-GB")} ·{" "}
              {viewingSession.sourceType}
            </p>
            {viewingSession.lines && viewingSession.lines.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-600">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700/50">
                      <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">
                        Item
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-slate-700 dark:text-slate-300">
                        System
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-slate-700 dark:text-slate-300">
                        Counted
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-slate-700 dark:text-slate-300">
                        Variance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingSession.lines.map((l: StockCountLineResponse) => (
                      <tr
                        key={l.id}
                        className="border-b border-slate-100 dark:border-slate-600/50"
                      >
                        <td className="px-3 py-2 text-slate-900 dark:text-white">
                          {l.itemName}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">
                          {l.systemQty}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-900 dark:text-white">
                          {l.countedQty}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-medium ${
                            l.varianceQty > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : l.varianceQty < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-slate-500"
                          }`}
                        >
                          {formatVariance(l.varianceQty)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {viewingSession.status === "OPEN" && (
              <>
                <div className="flex gap-2">
                  <select
                    value={addLineItemId}
                    onChange={(e) => setAddLineItemId(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  >
                    <option value="">Select item…</option>
                    {trackedItems.map((i: Item) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    placeholder="Qty"
                    value={addLineQty}
                    onChange={(e) => setAddLineQty(e.target.value)}
                    className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddLine}
                    disabled={
                      !addLineItemId ||
                      !addLineQty ||
                      addLineSubmitting
                    }
                    className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    {addLineSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Add
                  </button>
                </div>
                <div className="flex justify-between gap-2 border-t border-slate-200 pt-4 dark:border-slate-600">
                  <button
                    type="button"
                    onClick={refreshSession}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={closeSubmitting}
                    className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {closeSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Close session
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </SlideOver>
    </div>
  );
}
