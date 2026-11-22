import { useState, useMemo, useEffect, useRef } from "react";
import {
  useTableCustomizationContext,
  type ResolvedTableColumn,
  type TableDensity,
  computeDensityStyles,
} from "@/contexts/TableCustomizationContext";
import {
  TABLE_REGISTRY,
  TABLE_LIST,
  TABLE_CATEGORIES,
  type TableDefinition,
  type TableCategory,
} from "@/config/tableCustomizationRegistry";
import { ConfirmDialog } from "@/components/ui";
import {
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Search,
  Table2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
} from "lucide-react";

interface ColumnLabelInputProps {
  tableId: string;
  columnKey: string;
  defaultLabel: string;
  customLabel?: string;
}

function ColumnLabelInput({
  tableId,
  columnKey,
  defaultLabel,
  customLabel,
}: ColumnLabelInputProps) {
  const { setColumnLabel } = useTableCustomizationContext();
  const [localValue, setLocalValue] = useState(customLabel ?? "");
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(customLabel ?? "");
    }
  }, [customLabel]);

  return (
    <div className="flex items-center gap-2">
      <input
        id={`label-${tableId}-${columnKey}`}
        type="text"
        value={localValue}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onBlur={() => {
          isFocusedRef.current = false;
          setColumnLabel(tableId, columnKey, localValue, true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
        onChange={(e) => {
          const val = e.target.value;
          setLocalValue(val);
          setColumnLabel(tableId, columnKey, val);
        }}
        placeholder={defaultLabel}
        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
      />
      {customLabel && (
        <button
          type="button"
          onClick={() => {
            setLocalValue("");
            setColumnLabel(tableId, columnKey, "", true);
          }}
          title="Reset column label to default"
          className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function TableCustomizationSettingsSection() {
  const {
    getTableConfig,
    getTableDensity,
    getTablePageSize,
    getShowRowNumbers,
    getZebraStriping,
    setColumnVisibility,
    setColumnAlign,
    moveColumnOrder,
    setTableDensity,
    setTablePageSize,
    setShowRowNumbers,
    setZebraStriping,
    resetTableToDefaults,
    resetAllTablesToDefaults,
    isSaving,
  } = useTableCustomizationContext();

  const [activeCategory, setActiveCategory] = useState<TableCategory | "all">("all");
  const [selectedTableId, setSelectedTableId] = useState<string>("items");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [confirmResetTableOpen, setConfirmResetTableOpen] = useState(false);
  const [confirmResetAllOpen, setConfirmResetAllOpen] = useState(false);

  // Filter tables by category and search
  const filteredTables = useMemo(() => {
    return TABLE_LIST.filter((table) => {
      const matchesCategory =
        activeCategory === "all" || table.category === activeCategory;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const inTitle = table.title.toLowerCase().includes(q);
      const inDesc = table.description.toLowerCase().includes(q);
      const inCols = table.columns.some(
        (c) =>
          c.defaultLabel.toLowerCase().includes(q) ||
          c.key.toLowerCase().includes(q)
      );
      return inTitle || inDesc || inCols;
    });
  }, [activeCategory, searchQuery]);

  // Keep active table in sync with filtered results
  useEffect(() => {
    if (filteredTables.length > 0 && !filteredTables.some((t) => t.id === selectedTableId)) {
      setSelectedTableId(filteredTables[0].id);
    }
  }, [filteredTables, selectedTableId]);

  const activeDef: TableDefinition | undefined = TABLE_REGISTRY[selectedTableId];
  const columns: ResolvedTableColumn[] = useMemo(() => {
    return getTableConfig(selectedTableId);
  }, [getTableConfig, selectedTableId]);

  const visibleColumns = useMemo(() => {
    return columns.filter((c) => c.visible);
  }, [columns]);

  const density = getTableDensity(selectedTableId);
  const pageSize = getTablePageSize(selectedTableId);
  const showRowNumbers = getShowRowNumbers(selectedTableId);
  const zebraStriping = getZebraStriping(selectedTableId);
  const densityStyles = computeDensityStyles(density);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-white">
            <Table2 className="h-5 w-5 text-primary-500" />
            Datatable customization
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Rename columns, reorder column positions, toggle visibility, and customize table density, pagination, and styling across the system.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              Saving…
            </span>
          )}
          <button
            type="button"
            onClick={() => setConfirmResetAllOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset all tables
          </button>
        </div>
      </div>

      {/* Category Pills & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activeCategory === "all"
                ? "bg-primary-600 text-white shadow-sm dark:bg-primary-500"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            All tables ({TABLE_LIST.length})
          </button>
          {TABLE_CATEGORIES.map((cat) => {
            const count = TABLE_LIST.filter((t) => t.category === cat).length;
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? "bg-primary-600 text-white shadow-sm dark:bg-primary-500"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative min-w-[200px] max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tables or columns…"
            className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
        </div>
      </div>

      {/* Table Selector Pills */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
        {filteredTables.map((t) => {
          const isSelected = t.id === selectedTableId;
          const tableCols = getTableConfig(t.id);
          const hiddenCount = tableCols.filter((c) => !c.visible).length;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTableId(t.id)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                isSelected
                  ? "border-primary-500 bg-primary-50 text-primary-700 shadow-sm dark:border-primary-400 dark:bg-primary-950/40 dark:text-primary-300"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              <span>{t.title}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  hiddenCount > 0
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                }`}
              >
                {tableCols.length - hiddenCount}/{tableCols.length} cols
              </span>
            </button>
          );
        })}
      </div>

      {activeDef && (
        <div className="space-y-6">
          {/* Table Level Settings */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {activeDef.title}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {activeDef.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmResetTableOpen(true)}
                className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              >
                <RotateCcw className="h-3 w-3" />
                Reset this table
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-700/60">
              {/* Table Density */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Row density
                </label>
                <div className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-900">
                  {(["compact", "comfortable", "spacious"] as TableDensity[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setTableDensity(selectedTableId, d)}
                      className={`flex-1 rounded-md py-1 text-xs font-medium capitalize transition ${
                        density === d
                          ? "bg-white text-primary-700 shadow-sm dark:bg-slate-800 dark:text-primary-300"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Page Size */}
              <div>
                <label
                  htmlFor={`page-size-${selectedTableId}`}
                  className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Default rows per page
                </label>
                <select
                  id={`page-size-${selectedTableId}`}
                  value={pageSize}
                  onChange={(e) =>
                    setTablePageSize(selectedTableId, parseInt(e.target.value, 10))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                >
                  <option value={10}>10 rows</option>
                  <option value={20}>20 rows</option>
                  <option value={25}>25 rows</option>
                  <option value={50}>50 rows</option>
                  <option value={100}>100 rows</option>
                </select>
              </div>

              {/* Show Row Numbers */}
              <div className="flex items-center justify-between sm:justify-start sm:gap-3">
                <div>
                  <label
                    htmlFor={`row-numbers-${selectedTableId}`}
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Row numbers (#)
                  </label>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Display continuous row index
                  </p>
                </div>
                <input
                  id={`row-numbers-${selectedTableId}`}
                  type="checkbox"
                  checked={showRowNumbers}
                  onChange={(e) =>
                    setShowRowNumbers(selectedTableId, e.target.checked)
                  }
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
                />
              </div>

              {/* Zebra Striping */}
              <div className="flex items-center justify-between sm:justify-start sm:gap-3">
                <div>
                  <label
                    htmlFor={`zebra-${selectedTableId}`}
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Zebra striping
                  </label>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Alternate row background colors
                  </p>
                </div>
                <input
                  id={`zebra-${selectedTableId}`}
                  type="checkbox"
                  checked={zebraStriping}
                  onChange={(e) =>
                    setZebraStriping(selectedTableId, e.target.checked)
                  }
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
                />
              </div>
            </div>
          </div>

          {/* Columns Configuration List */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Columns & Layout Order
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Use the arrows to reorder columns. Edit the text to rename headers or change alignment.
                </p>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {visibleColumns.length} of {columns.length} columns visible
              </span>
            </div>

            <div className="space-y-2">
              {columns.map((col, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === columns.length - 1;
                const isModified =
                  Boolean(col.customLabel) ||
                  col.align !== col.defaultAlign ||
                  col.visible !== col.defaultVisible;

                return (
                  <div
                    key={col.key}
                    className={`flex flex-col gap-3 rounded-lg border p-3 transition sm:flex-row sm:items-center sm:justify-between ${
                      !col.visible
                        ? "border-slate-200 bg-slate-50/60 opacity-60 dark:border-slate-700 dark:bg-slate-800/40"
                        : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
                    }`}
                  >
                    {/* Left: Position and Order Buttons */}
                    <div className="flex items-center gap-2 sm:w-28">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        {idx + 1}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveColumnOrder(selectedTableId, col.key, "up")}
                          disabled={isFirst}
                          title={`Move ${col.label} up`}
                          aria-label={`Move ${col.label} up`}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-700"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveColumnOrder(selectedTableId, col.key, "down")}
                          disabled={isLast}
                          title={`Move ${col.label} down`}
                          aria-label={`Move ${col.label} down`}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-700"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Middle: Rename Column Input */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={`label-${selectedTableId}-${col.key}`}
                          className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate"
                        >
                          {col.defaultLabel}
                        </label>
                        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                          ({col.key})
                        </span>
                        {isModified && (
                          <span className="rounded bg-sky-100 px-1.5 py-0.2 text-[10px] font-semibold text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                            Custom
                          </span>
                        )}
                      </div>
                      <div className="mt-1">
                        <ColumnLabelInput
                          tableId={selectedTableId}
                          columnKey={col.key}
                          defaultLabel={col.defaultLabel}
                          customLabel={col.customLabel}
                        />
                      </div>
                    </div>

                    {/* Right: Alignment & Visibility Controls */}
                    <div className="flex items-center gap-3 self-end sm:self-center">
                      {/* Alignment */}
                      <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-900">
                        <button
                          type="button"
                          onClick={() => setColumnAlign(selectedTableId, col.key, "left")}
                          title="Align left"
                          aria-label={`Align ${col.label} left`}
                          className={`rounded p-1 transition ${
                            col.align === "left"
                              ? "bg-white text-primary-600 shadow-sm dark:bg-slate-800 dark:text-primary-400"
                              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          }`}
                        >
                          <AlignLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setColumnAlign(selectedTableId, col.key, "center")}
                          title="Align center"
                          aria-label={`Align ${col.label} center`}
                          className={`rounded p-1 transition ${
                            col.align === "center"
                              ? "bg-white text-primary-600 shadow-sm dark:bg-slate-800 dark:text-primary-400"
                              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          }`}
                        >
                          <AlignCenter className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setColumnAlign(selectedTableId, col.key, "right")}
                          title="Align right"
                          aria-label={`Align ${col.label} right`}
                          className={`rounded p-1 transition ${
                            col.align === "right"
                              ? "bg-white text-primary-600 shadow-sm dark:bg-slate-800 dark:text-primary-400"
                              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          }`}
                        >
                          <AlignRight className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Visibility Toggle */}
                      <button
                        type="button"
                        onClick={() => setColumnVisibility(selectedTableId, col.key, !col.visible)}
                        disabled={!col.canHide}
                        title={
                          !col.canHide
                            ? "Mandatory column"
                            : col.visible
                            ? `Hide ${col.label}`
                            : `Show ${col.label}`
                        }
                        aria-label={
                          col.visible
                            ? `Hide ${col.label}`
                            : `Show ${col.label}`
                        }
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                          !col.canHide
                            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
                            : col.visible
                            ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                            : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300"
                        }`}
                      >
                        {col.visible ? (
                          <>
                            <Eye className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                            <span>Visible</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Hidden</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Interactive Preview */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary-500" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Live Preview: {activeDef.title}
                </h4>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Density: {density} &bull; Zebra: {zebraStriping ? "On" : "Off"} &bull; Row numbers: {showRowNumbers ? "On" : "Off"}
              </span>
            </div>

            {visibleColumns.length === 0 ? (
              <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-6 text-center text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                All columns are currently hidden. Enable at least one column to view data in this table.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full divide-y divide-slate-200 dark:divide-slate-700">
                  <thead className="bg-slate-50 dark:bg-slate-700">
                    <tr>
                      {showRowNumbers && (
                        <th
                          scope="col"
                          className={`${densityStyles.th} w-10 text-center font-bold`}
                        >
                          #
                        </th>
                      )}
                      {visibleColumns.map((c) => (
                        <th
                          key={c.key}
                          scope="col"
                          className={`${densityStyles.th} ${
                            c.align === "right"
                              ? "text-right"
                              : c.align === "center"
                              ? "text-center"
                              : "text-left"
                          }`}
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
                    {(activeDef.sampleData ?? []).map((row, rowIdx) => {
                      const isEven = rowIdx % 2 === 1;
                      const zebraClass =
                        zebraStriping && isEven
                          ? "bg-slate-50/70 dark:bg-slate-700/30"
                          : "";
                      return (
                        <tr
                          key={rowIdx}
                          className={`hover:bg-slate-50/50 dark:hover:bg-slate-700/40 ${zebraClass}`}
                        >
                          {showRowNumbers && (
                            <td
                              className={`${densityStyles.td} w-10 text-center text-slate-400 tabular-nums dark:text-slate-500`}
                            >
                              {rowIdx + 1}
                            </td>
                          )}
                          {visibleColumns.map((c) => {
                            const val = row[c.key];
                            const display =
                              val !== undefined && val !== null
                                ? String(val)
                                : "—";
                            return (
                              <td
                                key={c.key}
                                className={`${densityStyles.td} ${
                                  c.align === "right"
                                    ? "text-right tabular-nums"
                                    : c.align === "center"
                                    ? "text-center"
                                    : "text-left"
                                }`}
                              >
                                {display}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reset Table Confirm Dialog */}
      <ConfirmDialog
        open={confirmResetTableOpen}
        title={`Reset ${activeDef?.title ?? "Table"}?`}
        message="This will reset all column names, position order, column visibility, density, page size, and styling options for this table back to system factory defaults."
        confirmLabel="Reset table"
        onConfirm={() => {
          resetTableToDefaults(selectedTableId);
          setConfirmResetTableOpen(false);
        }}
        onClose={() => setConfirmResetTableOpen(false)}
      />

      {/* Reset All Tables Confirm Dialog */}
      <ConfirmDialog
        open={confirmResetAllOpen}
        title="Reset all tables to system defaults?"
        message="This will revert all customized column names, positions, visibility toggles, and operational defaults across every datatable in the entire system to initial factory defaults. This action cannot be undone."
        confirmLabel="Reset all tables"
        onConfirm={() => {
          resetAllTablesToDefaults();
          setConfirmResetAllOpen(false);
        }}
        onClose={() => setConfirmResetAllOpen(false)}
      />
    </div>
  );
}
