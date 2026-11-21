import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import { fetchInventoryReport, type InventoryReportLineResponse } from "@/api/inventoryReport";
import { fetchAllOrgItems } from "@/api/items";
import { filterActiveOrgs, filterNonDeletedBranches } from "@/types/org";
import { PageHeader } from "@/components/PageHeader";
import { InlineCopilot } from "@/components/InlineCopilot";
import {
  Button,
  Pagination,
  SortableTableHead,
  TableRowNumberHead,
  TableRowNumberCell,
  TableSearchInput,
  TableSkeleton,
  tableBodyRow,
  tableStickyHeadCell,
  tableHeadCell,
  tableBodyCellNumDebts,
  tableStickyFirstBody,
  tableEmptyCell,
  tableCard,
  tableRowNoCol,
} from "@/components/ui";
import { useQueryDisplay } from "@/hooks/useQueryDisplay";
import { useDataTable } from "@/hooks/useDataTable";
import { TABLE_SEARCH_FETCH_SIZE } from "@/constants/tableSearch";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { formatAmount } from "@/utils/formatCurrency";
import { formatQty } from "@/utils/formatQuantity";
import { useToast } from "@/contexts/ToastContext";
import { downloadItemsPdf } from "@/utils/itemsPdf";
import { filterRowsBySearch } from "@/utils/tableSearchMatch";
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Flame,
  Package,
  Percent,
  TrendingDown,
  TrendingUp,
  Download,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";

const DEFAULT_PAGE_SIZE = 20;
const LOW_STOCK_THRESHOLD = 5;
const ANALYTICS_FETCH_SIZE = 500;
const INVENTORY_SORT = {
  itemName: (row: InventoryReportLineResponse) => row.itemName,
  receivedQty: (row: InventoryReportLineResponse) => row.receivedQty,
  onHandQty: (row: InventoryReportLineResponse) => row.onHandQty,
  soldQty: (row: InventoryReportLineResponse) => row.soldQty,
};

export interface InventoryPageProps {
  initialOrgId?: string;
  initialBranchId?: string;
}

export function InventoryPage({
  initialOrgId,
  initialBranchId,
}: InventoryPageProps = {}) {
  const token = useAppSelector(selectToken);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(initialOrgId ?? "");
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId ?? "");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [showAnalytics, setShowAnalytics] = useState<boolean>(false);

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

  const reportQuery = useQuery({
    queryKey: ["admin-inventory-report", token, selectedOrgId, selectedBranchId],
    queryFn: () =>
      fetchInventoryReport(token, selectedOrgId, selectedBranchId, {
        page: 0,
        size: TABLE_SEARCH_FETCH_SIZE,
      }),
    enabled:
      Boolean(token) && Boolean(selectedOrgId) && Boolean(selectedBranchId),
  });
  const { data: reportData, isError, error, refetch } = reportQuery;
  const { isInitialLoad, isRefreshing } = useQueryDisplay(reportQuery);

  const { data: analyticsData, isLoading: isAnalyticsLoading } = useQuery({
    queryKey: [
      "admin-inventory-report-analytics",
      token,
      selectedOrgId,
      selectedBranchId,
    ],
    queryFn: () =>
      fetchInventoryReport(token, selectedOrgId, selectedBranchId, {
        page: 0,
        size: ANALYTICS_FETCH_SIZE,
      }),
    enabled:
      showAnalytics &&
      Boolean(token) &&
      Boolean(selectedOrgId) &&
      Boolean(selectedBranchId),
  });

  const { data: analyticsItems, isLoading: isItemsLoading } = useQuery({
    queryKey: ["admin-inventory-analytics-items", token, selectedOrgId],
    queryFn: () => fetchAllOrgItems(token, selectedOrgId),
    enabled: showAnalytics && Boolean(token) && Boolean(selectedOrgId),
  });

  const orgs = orgsData?.content ?? [];
  const branches = branchesData?.content ?? [];
  const filteredOrgs = filterActiveOrgs(orgs);
  const filteredBranches = filterNonDeletedBranches(branches);
  const lines = reportData?.content ?? [];

  const toast = useToast();
  const [downloadingItemsPdf, setDownloadingItemsPdf] = useState(false);

  const handleDownloadItemsPdf = async () => {
    if (!token || !selectedOrgId) return;
    setDownloadingItemsPdf(true);
    try {
      const allItems = await fetchAllOrgItems(token, selectedOrgId);
      let exportItems = allItems.filter((i) => i.active);
      if (searchQuery.trim()) {
        exportItems = filterRowsBySearch(exportItems, searchQuery, undefined, {
          name: (i) => i.name,
          sku: (i) => i.sku ?? "",
        });
      }
      if (exportItems.length === 0) {
        toast.error("No items matching the search query to export.");
        return;
      }
      const orgName = orgs.find((o) => o.id === selectedOrgId)?.name ?? "Organization";
      const pdfOptions: {
        orgName?: string | null;
        searchQuery?: string;
      } = { orgName };
      if (searchQuery.trim()) {
        pdfOptions.searchQuery = searchQuery.trim();
      }
      downloadItemsPdf(exportItems, pdfOptions);
      toast.success("PDF downloaded.", { title: "Items list" });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setDownloadingItemsPdf(false);
    }
  };

  const {
    searchQuery,
    setSearchQuery,
    filteredRows: filteredLines,
    totalElements,
    sortColumn,
    sortDirection,
    toggleSort,
  } = useDataTable(lines, undefined, {
    page,
    size,
    setPage,
    sortAccessors: INVENTORY_SORT,
  });

  const analytics = useMemo(() => {
    const all = analyticsData?.content ?? [];
    const tracked = all.filter((l) => l.trackInventory);
    const buyingPriceByItemId = new Map<string, number>();
    for (const item of analyticsItems ?? []) {
      if (typeof item.buyingPrice === "number") {
        buyingPriceByItemId.set(item.id, item.buyingPrice);
      }
    }
    let outOfStock = 0;
    let lowStock = 0;
    let healthy = 0;
    let totalReceived = 0;
    let totalSold = 0;
    let totalOnHand = 0;
    let totalOnHandCost = 0;
    let onHandItemsWithoutCost = 0;
    for (const l of all) {
      totalReceived += l.receivedQty;
      totalSold += l.soldQty;
      totalOnHand += l.onHandQty;
      if (l.onHandQty > 0) {
        const cost = buyingPriceByItemId.get(l.itemId);
        if (cost != null) {
          totalOnHandCost += l.onHandQty * cost;
        } else {
          onHandItemsWithoutCost += 1;
        }
      }
    }
    for (const l of tracked) {
      if (l.onHandQty <= 0) outOfStock += 1;
      else if (l.onHandQty < LOW_STOCK_THRESHOLD) lowStock += 1;
      else healthy += 1;
    }
    const sellThroughPct =
      totalReceived > 0
        ? Math.round((totalSold / totalReceived) * 100)
        : 0;
    const topSellers = [...all]
      .filter((l) => l.soldQty > 0)
      .sort((a, b) => b.soldQty - a.soldQty)
      .slice(0, 3);
    const stagnant = tracked
      .filter((l) => l.soldQty === 0 && l.onHandQty > 0)
      .sort((a, b) => b.onHandQty - a.onHandQty)
      .slice(0, 3);
    return {
      totalItems: all.length,
      trackedItems: tracked.length,
      outOfStock,
      lowStock,
      healthy,
      totalReceived,
      totalSold,
      totalOnHand,
      totalOnHandCost,
      onHandItemsWithoutCost,
      sellThroughPct,
      topSellers,
      stagnant,
    };
  }, [analyticsData, analyticsItems]);

  useEffect(() => {
    if (initialOrgId) {
      setSelectedOrgId(initialOrgId);
    } else if (!selectedOrgId && filteredOrgs.length > 0) {
      setSelectedOrgId(filteredOrgs[0].id);
    }
  }, [initialOrgId, filteredOrgs, selectedOrgId]);

  useEffect(() => {
    if (initialBranchId) {
      setSelectedBranchId(initialBranchId);
    } else if (selectedOrgId && !selectedBranchId && filteredBranches.length > 0) {
      setSelectedBranchId(filteredBranches[0].id);
    }
  }, [initialBranchId, selectedOrgId, filteredBranches, selectedBranchId]);
  useEffect(() => {
    setPage(0);
  }, [searchQuery, size]);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <PageHeader
        title="Inventory"
        subtitle="Track sold items versus remaining stock by branch. Select organization and branch to view inventory."
        icon={Package}
        fallbackTo="/admin"
      />

      {selectedOrgId && selectedBranchId && (
        <InlineCopilot
          screen="inventory"
          label="Ask about inventory"
          placeholder="Low stock, stock variance…"
          className="mb-4 px-6"
        />
      )}

      {!selectedOrgId || !selectedBranchId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select organization and branch to view inventory (sold vs remaining).
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <TableSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search inventory…"
              className="w-full sm:w-72"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={showAnalytics}
                aria-label={showAnalytics ? "Hide analytics" : "Show analytics"}
                onClick={() => setShowAnalytics((v) => !v)}
                className={`flex min-h-[40px] items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                  showAnalytics
                    ? "border-primary-500 bg-primary-600/15 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-200"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
                <span>Analytics</span>
                {showAnalytics ? (
                  <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                )}
              </button>
              <Button
                variant="outline"
                onClick={handleDownloadItemsPdf}
                disabled={downloadingItemsPdf || !selectedOrgId}
                title="Download PDF document of all items"
                aria-label="Download"
                className="flex min-h-[40px] items-center gap-1.5"
              >
                {downloadingItemsPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>Download</span>
              </Button>
            </div>
          </div>
          {showAnalytics && (
            <AnalyticsPanel
              analytics={analytics}
              isLoading={isAnalyticsLoading || isItemsLoading}
            />
          )}
          <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">← swipe table to see all columns →</p>
          <div className={tableCard}>
            <div className="relative min-h-0 flex-1 overflow-auto">
              <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
              <table className="w-full table-fixed divide-y divide-slate-200 dark:divide-slate-700" style={{ minWidth: "720px" }}>
                <colgroup>
                  <col className={tableRowNoCol} />
                  <col className="w-[38%]" />
                  <col className="w-[18%]" />
                  <col className="w-[18%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <TableRowNumberHead />
                    <SortableTableHead
                      columnKey="itemName"
                      label="Item"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={`${tableStickyHeadCell} ${tableHeadCell}`}
                    />
                    <SortableTableHead
                      columnKey="receivedQty"
                      label="Received"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
                    <SortableTableHead
                      columnKey="onHandQty"
                      label="On hand"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
                    <SortableTableHead
                      columnKey="soldQty"
                      label="Sold"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {isInitialLoad ? (
                    <TableSkeleton rows={10} columns={5} />
                  ) : filteredLines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className={tableEmptyCell}
                      >
                        {lines.length === 0 ? (
                          <>
                            No inventory at this branch yet.{" "}
                            <Link
                              to="/admin/inventory?tab=stock"
                              className="font-medium text-primary-600 underline hover:no-underline dark:text-primary-400"
                            >
                              Add stock
                            </Link>{" "}
                            to add stock.
                          </>
                        ) : "No results match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredLines.map((line: InventoryReportLineResponse, index) => (
                      <tr
                        key={line.itemId}
                        className={tableBodyRow}
                      >
                    <TableRowNumberCell page={page} pageSize={size} indexInPage={index} />
                        <td className={tableStickyFirstBody}>
                          <span>
                            {line.itemName}
                          </span>
                          {!line.trackInventory && (
                            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                              (not tracked)
                            </span>
                          )}
                        </td>
                        <td className={tableBodyCellNumDebts}>
                          {formatQty(line.receivedQty)}
                        </td>
                        <td className={tableBodyCellNumDebts}>
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <TrendingUp className="h-4 w-4" />
                            {formatQty(line.onHandQty)}
                          </span>
                        </td>
                        <td className={tableBodyCellNumDebts}>
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                            <TrendingDown className="h-4 w-4" />
                            {formatQty(line.soldQty)}
                          </span>
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
                  onSizeChange={(s) => {
                    setSize(s);
                    setPage(0);
                  }}
                  sizeOptions={[10, 20, 50]}
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

interface AnalyticsShape {
  totalItems: number;
  trackedItems: number;
  outOfStock: number;
  lowStock: number;
  healthy: number;
  totalReceived: number;
  totalSold: number;
  totalOnHand: number;
  totalOnHandCost: number;
  onHandItemsWithoutCost: number;
  sellThroughPct: number;
  topSellers: InventoryReportLineResponse[];
  stagnant: InventoryReportLineResponse[];
}

function AnalyticsPanel({
  analytics,
  isLoading,
}: {
  analytics: AnalyticsShape;
  isLoading: boolean;
}) {
  const showAnalyticsSkeleton = isLoading && analytics.totalItems === 0;

  if (!showAnalyticsSkeleton && analytics.totalItems === 0) {
    return (
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        No inventory yet — analytics will appear once stock is received.
      </div>
    );
  }

  const {
    outOfStock,
    lowStock,
    healthy,
    totalReceived,
    totalSold,
    totalOnHand,
    totalOnHandCost,
    onHandItemsWithoutCost,
    sellThroughPct,
    topSellers,
    stagnant,
  } = analytics;

  return (
    <div className="mb-4 space-y-3">
      {showAnalyticsSkeleton ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-700/60"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-700/60"
              />
            ))}
          </div>
        </>
      ) : (
        <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatusCard
          tone="red"
          icon={AlertTriangle}
          label="Out of stock"
          value={outOfStock}
          hint="Tracked items with 0 on hand"
        />
        <StatusCard
          tone="amber"
          icon={AlertCircle}
          label="Low stock"
          value={lowStock}
          hint={`Below ${LOW_STOCK_THRESHOLD} units`}
        />
        <StatusCard
          tone="emerald"
          icon={CheckCircle2}
          label="Healthy"
          value={healthy}
          hint={`${LOW_STOCK_THRESHOLD}+ units on hand`}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard icon={Package} label="Received" value={formatQty(totalReceived)} />
        <MetricCard
          icon={TrendingDown}
          label="Sold"
          value={formatQty(totalSold)}
          valueClass="text-amber-700 dark:text-amber-400"
        />
        <MetricCard
          icon={TrendingUp}
          label="On hand"
          value={formatQty(totalOnHand)}
          valueClass="text-emerald-700 dark:text-emerald-400"
        />
        <MetricCard
          icon={Coins}
          label="On-hand value"
          value={formatAmount(totalOnHandCost)}
          valueClass="text-primary-700 dark:text-primary-300"
          hint={
            onHandItemsWithoutCost > 0
              ? `${onHandItemsWithoutCost} item${onHandItemsWithoutCost === 1 ? "" : "s"} missing buy price`
              : "at current buying prices"
          }
        />
        <MetricCard
          icon={Percent}
          label="Sell-through"
          value={`${sellThroughPct}%`}
          hint="of received units sold"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <InsightList
          title="Top sellers"
          icon={Flame}
          tone="emerald"
          items={topSellers.map((l) => ({
            id: l.itemId,
            name: l.itemName,
            primary: `${formatQty(l.soldQty)} sold`,
          }))}
          emptyText="No sales yet in this inventory."
        />
        <InsightList
          title="Stagnant items"
          icon={Clock}
          tone="amber"
          items={stagnant.map((l) => ({
            id: l.itemId,
            name: l.itemName,
            primary: `${formatQty(l.onHandQty)} sitting`,
          }))}
          emptyText="Nothing stagnant — all tracked items are moving."
        />
      </div>
        </>
      )}
    </div>
  );
}

const TONE_STYLES: Record<
  "red" | "amber" | "emerald",
  { border: string; bg: string; text: string; iconBg: string }
> = {
  red: {
    border: "border-red-200 dark:border-red-900/60",
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-300",
    iconBg: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300",
  },
  amber: {
    border: "border-amber-200 dark:border-amber-900/60",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-300",
    iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300",
  },
  emerald: {
    border: "border-emerald-200 dark:border-emerald-900/60",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-300",
    iconBg:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
};

function StatusCard({
  tone,
  icon: Icon,
  label,
  value,
  hint,
}: {
  tone: "red" | "amber" | "emerald";
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  hint: string;
}) {
  const t = TONE_STYLES[tone];
  return (
    <div className={`flex items-center gap-3 rounded-xl border ${t.border} ${t.bg} p-4 shadow-sm`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${t.iconBg}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className={`text-2xl font-bold tabular-nums ${t.text}`}>{value}</div>
        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {label}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  valueClass,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClass?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${valueClass ?? "text-slate-800 dark:text-slate-100"}`}>
        {value}
      </div>
      {hint && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</div>
      )}
    </div>
  );
}

function InsightList({
  title,
  icon: Icon,
  tone,
  items,
  emptyText,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "emerald" | "amber";
  items: { id: string; name: string; primary: string }[];
  emptyText: string;
}) {
  const t = TONE_STYLES[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.iconBg}`}>
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>
      ) : (
        <ol className="space-y-2">
          {items.map((it, idx) => (
            <li
              key={it.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-700/40"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 dark:bg-slate-600 dark:text-slate-200">
                  {idx + 1}
                </span>
                <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                  {it.name}
                </span>
              </div>
              <span className={`shrink-0 text-sm font-semibold tabular-nums ${t.text}`}>
                {it.primary}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
