import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Plus,
  Loader2,
  Check,
  ArrowLeft,
  Download,
  Share2,
  Pencil,
  Trash2,
} from "lucide-react";
import { formatCurrency } from "@/utils/formatCurrency";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ui";
import { useToast } from "@/contexts/ToastContext";
import { useNavVisibilityContextOrNull } from "@/contexts/NavVisibilityContext";
import { APP_NAME_KEY } from "@/config/headerNavItems";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import {
  downloadStockCountPdf,
  shareStockCountPdf,
} from "@/utils/stockCountPdf";
import type {
  StockCountSessionResponse,
  StockCountLineResponse,
} from "@/api/stockTaking";
import type { Item } from "@/types/catalog";

export interface StockCountSessionDetailPageProps {
  token: string | null;
  orgId: string;
  branchName?: string | null;
  orgName?: string | null;
  fetchSession: (sessionId: string) => Promise<StockCountSessionResponse>;
  addLine: (
    sessionId: string,
    body: { itemId: string; countedQty: number }
  ) => Promise<StockCountSessionResponse>;
  updateLine: (
    sessionId: string,
    lineId: string,
    body: { countedQty: number }
  ) => Promise<StockCountSessionResponse>;
  deleteLine: (sessionId: string, lineId: string) => Promise<StockCountSessionResponse>;
  closeSession: (sessionId: string) => Promise<StockCountSessionResponse>;
  fetchItems: (
    token: string,
    orgId: string,
    params?: { size?: number }
  ) => Promise<{ content: Item[] }>;
  backHref: string;
  queryKey: string[];
}

function formatVariance(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v}`;
}

export function StockCountSessionDetailPage({
  token,
  orgId,
  branchName,
  orgName,
  fetchSession,
  addLine,
  updateLine,
  deleteLine,
  closeSession,
  fetchItems,
  backHref,
  queryKey,
}: StockCountSessionDetailPageProps) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const navVisibility = useNavVisibilityContextOrNull();
  const appName = navVisibility
    ? navVisibility.getHeaderLabel(APP_NAME_KEY, "XPOS")
    : "XPOS";

  const [addLineItemId, setAddLineItemId] = useState("");
  const [addLineQty, setAddLineQty] = useState("");
  const [addLineSubmitting, setAddLineSubmitting] = useState(false);
  const [closeSubmitting, setCloseSubmitting] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingQty, setEditingQty] = useState("");
  const [deleteConfirmLineId, setDeleteConfirmLineId] = useState<string | null>(null);

  const { data: session, isLoading, isError, error } = useQuery({
    queryKey: [...queryKey, "session", sessionId],
    queryFn: () => fetchSession(sessionId!),
    enabled: Boolean(token && orgId && sessionId),
  });

  const { data: itemsData } = useQuery({
    queryKey: ["items", token, orgId],
    queryFn: () => fetchItems(token!, orgId, { size: 500 }),
    enabled: Boolean(token && orgId) && Boolean(session?.status === "OPEN"),
  });

  const items = itemsData?.content ?? [];
  const trackedItems = items.filter((i: Item) => i.trackInventory);

  async function handleAddLine() {
    if (!session || !addLineItemId || !addLineQty || !sessionId) return;
    const qty = parseFloat(addLineQty);
    if (isNaN(qty) || qty < 0) {
      toast.error("Enter a valid non-negative quantity.", {
        title: "Validation",
      });
      return;
    }
    setAddLineSubmitting(true);
    try {
      await addLine(sessionId, { itemId: addLineItemId, countedQty: qty });
      setAddLineItemId("");
      setAddLineQty("");
      queryClient.invalidateQueries({ queryKey: [...queryKey, "session"] });
      queryClient.invalidateQueries({ queryKey });
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

  async function handleUpdateLine(lineId: string) {
    if (!sessionId) return;
    const qty = parseFloat(editingQty);
    if (isNaN(qty) || qty < 0) {
      toast.error("Enter a valid non-negative quantity.", { title: "Validation" });
      return;
    }
    try {
      await updateLine(sessionId, lineId, { countedQty: qty });
      setEditingLineId(null);
      setEditingQty("");
      queryClient.invalidateQueries({ queryKey: [...queryKey, "session"] });
      queryClient.invalidateQueries({ queryKey });
      toast.success("Count line updated.", { title: "Stock count" });
    } catch (err) {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    }
  }

  async function handleDeleteLine(lineId: string) {
    if (!sessionId) return;
    try {
      await deleteLine(sessionId, lineId);
      setDeleteConfirmLineId(null);
      queryClient.invalidateQueries({ queryKey: [...queryKey, "session"] });
      queryClient.invalidateQueries({ queryKey });
      toast.success("Count line removed.", { title: "Stock count" });
    } catch (err) {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    }
  }

  async function handleClose() {
    if (!session || !sessionId) return;
    setCloseSubmitting(true);
    try {
      await closeSession(sessionId);
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["stockLevels"] });
      toast.success("Session closed. Stock adjusted.", { title: "Stock count" });
      navigate(backHref);
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

  function handleDownloadPdf() {
    if (!session) return;
    downloadStockCountPdf(session, branchName, orgName, appName);
    toast.success("PDF downloaded.", { title: "Stock count" });
  }

  function handleSharePdf() {
    if (!session) return;
    shareStockCountPdf(session, branchName, orgName, appName);
    toast.success("Report shared or downloaded.", { title: "Stock count" });
  }

  if (!sessionId) {
    return (
      <div className="p-6">
        <p className="text-slate-600 dark:text-slate-400">Invalid session.</p>
        <Link to={backHref} className="mt-2 inline-flex text-primary-600">
          ← Back to sessions
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="p-6">
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          <p>{error ? getApiErrorMessage(error) : "Session not found."}</p>
        </div>
        <Link
          to={backHref}
          className="mt-4 inline-flex items-center gap-1 text-primary-600 hover:underline dark:text-primary-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sessions
        </Link>
      </div>
    );
  }

  const lines = session.lines ?? [];

  const totalCountedValue = lines.reduce(
    (sum, l) =>
      sum +
      l.countedQty * (l.sellingPrice ?? l.unitCost ?? 0),
    0
  );
  const totalSoldValue = lines.reduce(
    (sum, l) =>
      sum + (l.qtySold ?? 0) * (l.sellingPrice ?? 0),
    0
  );
  const correctTotalSales = lines.reduce(
    (sum, l) =>
      sum + l.systemQty * (l.sellingPrice ?? 0),
    0
  );
  const totalVarianceValue = lines.reduce(
    (sum, l) =>
      sum +
      l.varianceQty * (l.sellingPrice ?? l.unitCost ?? 0),
    0
  );
  const totalVariancePositive = lines.reduce(
    (sum, l) => {
      const v = l.varianceQty * (l.sellingPrice ?? l.unitCost ?? 0);
      return sum + (v > 0 ? v : 0);
    },
    0
  );
  const totalVarianceNegative = lines.reduce(
    (sum, l) => {
      const v = l.varianceQty * (l.sellingPrice ?? l.unitCost ?? 0);
      return sum + (v < 0 ? v : 0);
    },
    0
  );

  return (
    <div className="min-h-0 flex-1 overflow-auto p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title={`Stock count ${session.status === "OPEN" ? "(open)" : "(closed)"}`}
          subtitle={`${branchName ?? "Branch"} · Started ${new Date(session.startedAt).toLocaleString("en-GB")} · ${session.sourceType}`}
          icon={ClipboardList}
          fallbackTo="/operator"
          noMargin
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
          <button
            type="button"
            onClick={handleSharePdf}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Share2 className="h-4 w-4" />
            Share report
          </button>
          {session.status === "OPEN" && (
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
          )}
        </div>
      </div>

      {/* Counted items – full page display */}
      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Items counted
          </h2>
        </div>
        {lines.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            No items counted yet. Add items below when the session is open.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-600">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                    Item
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                    System qty
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                    Counted qty
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                    Variance
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                    Unit cost
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                    Qty sold
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                    Selling price
                  </th>
                  {session.status === "OPEN" && (
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                {lines.map((l: StockCountLineResponse) => (
                  <tr
                    key={l.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                      {l.itemName}
                    </td>
                    <td className="px-4 py-3 text-left text-sm text-slate-600 dark:text-slate-400">
                      {l.systemQty}
                    </td>
                    <td className="px-4 py-3 text-left text-sm font-medium text-slate-900 dark:text-white">
                      {l.countedQty}
                    </td>
                    <td
                      className={`px-4 py-3 text-left text-sm font-medium ${
                        l.varianceQty > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : l.varianceQty < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {formatVariance(l.varianceQty)}
                    </td>
                    <td className="px-4 py-3 text-left text-sm text-slate-600 dark:text-slate-400">
                      {l.unitCost != null ? formatCurrency(l.unitCost) : "—"}
                    </td>
                    <td className="px-4 py-3 text-left text-sm text-slate-600 dark:text-slate-400">
                      {l.qtySold ?? 0}
                    </td>
                    <td className="px-4 py-3 text-left text-sm text-slate-600 dark:text-slate-400">
                      {l.sellingPrice != null ? formatCurrency(l.sellingPrice) : "—"}
                    </td>
                    {session.status === "OPEN" && (
                      <td className="px-4 py-3 text-left">
                        {editingLineId === l.id ? (
                          <div className="flex items-center justify-start gap-1">
                            <input
                              type="number"
                              min={0}
                              step="0.001"
                              value={editingQty}
                              onChange={(e) => setEditingQty(e.target.value)}
                              className="w-20 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateLine(l.id)}
                              className="rounded px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLineId(null);
                                setEditingQty("");
                              }}
                              className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-start gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLineId(l.id);
                                setEditingQty(String(l.countedQty));
                              }}
                              className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
                              title="Edit"
                              aria-label="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmLineId(l.id)}
                              className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                              title="Delete"
                              aria-label="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary badges */}
      {lines.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-600 dark:bg-slate-800/50">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Total value (counted)
            </span>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              {formatCurrency(totalCountedValue)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-600 dark:bg-slate-800/50">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Total sold
            </span>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              {formatCurrency(totalSoldValue)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-600 dark:bg-slate-800/50">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Expected (system)
            </span>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              {formatCurrency(correctTotalSales)}
            </p>
          </div>
          <div
            className="group relative cursor-help rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-600 dark:bg-slate-800/50"
            title="Total variance (in value): Sum of (counted qty − system qty) × price per item. Positive = surplus (more stock than system). Negative = shortage (less stock than system)."
          >
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Total variance
            </span>
            <p className="mt-1 flex items-center gap-2">
              {totalVariancePositive > 0 && (
                <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                  +{formatCurrency(totalVariancePositive)}
                </span>
              )}
              {totalVarianceNegative < 0 && (
                <span className="text-lg font-semibold text-red-600 dark:text-red-400">
                  {formatCurrency(totalVarianceNegative)}
                </span>
              )}
              {totalVarianceValue === 0 && (
                <span className="text-lg font-semibold text-slate-500 dark:text-slate-400">
                  {formatCurrency(0)}
                </span>
              )}
            </p>
            <div
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden max-w-xs -translate-x-1/2 rounded-lg border border-slate-200 bg-slate-800 px-3 py-2 text-xs text-slate-200 shadow-lg group-hover:block dark:border-slate-600 dark:bg-slate-900"
            >
              Sum of (counted qty − system qty) × selling price per item.
              Positive = surplus; negative = shortage.
            </div>
          </div>
        </div>
      )}

      {/* Add line form – only when session is open */}
      {session.status === "OPEN" && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Add count line
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={addLineItemId}
              onChange={(e) => setAddLineItemId(e.target.value)}
              className="min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
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
              className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
            <button
              type="button"
              onClick={handleAddLine}
              disabled={
                !addLineItemId || !addLineQty || addLineSubmitting
              }
              className="flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {addLineSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirmLineId != null}
        title="Remove count line"
        message={
          deleteConfirmLineId
            ? "Remove this count line from the session? You can add it again if needed."
            : ""
        }
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() =>
          deleteConfirmLineId && handleDeleteLine(deleteConfirmLineId)
        }
        onClose={() => setDeleteConfirmLineId(null)}
      />
    </div>
  );
}
