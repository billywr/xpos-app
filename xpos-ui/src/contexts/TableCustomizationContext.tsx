import { createContext, useContext, useMemo } from "react";
import {
  TABLE_REGISTRY,
  type TableDefinition,
} from "@/config/tableCustomizationRegistry";

export type TableDensity = "compact" | "comfortable" | "spacious";

export interface ResolvedTableColumn {
  key: string;
  label: string;
  defaultLabel: string;
  customLabel?: string;
  visible: boolean;
  defaultVisible: boolean;
  canHide: boolean;
  order: number;
  defaultOrder: number;
  align: "left" | "center" | "right";
  defaultAlign?: "left" | "center" | "right";
  sortable: boolean;
}

export interface TableDensityStyles {
  th: string;
  td: string;
  tdNum: string;
}

export function computeDensityStyles(density: TableDensity): TableDensityStyles {
  switch (density) {
    case "compact":
      return {
        th: "px-3 py-2 text-left text-sm font-semibold tracking-normal text-slate-700 sm:text-base dark:text-slate-300",
        td: "px-3 py-1.5 text-sm text-slate-600 sm:text-base dark:text-slate-400",
        tdNum: "px-3 py-1.5 text-right text-sm tabular-nums text-slate-600 sm:text-base dark:text-slate-400",
      };
    case "spacious":
      return {
        th: "px-6 py-4 text-left text-xl font-semibold tracking-normal text-slate-700 sm:text-2xl dark:text-slate-300",
        td: "px-6 py-3.5 text-xl text-slate-600 sm:text-2xl dark:text-slate-400",
        tdNum: "px-6 py-3.5 text-right text-xl tabular-nums text-slate-600 sm:text-2xl dark:text-slate-400",
      };
    case "comfortable":
    default:
      return {
        th: "px-4 py-3 text-left text-lg font-semibold tracking-normal text-slate-700 sm:px-6 sm:py-3 sm:text-xl dark:text-slate-300",
        td: "px-4 py-2 text-lg text-slate-600 sm:px-6 sm:py-2.5 sm:text-xl dark:text-slate-400",
        tdNum: "px-4 py-2 text-right text-lg tabular-nums text-slate-600 sm:px-6 sm:py-2.5 sm:text-xl dark:text-slate-400",
      };
  }
}

export interface TableCustomizationContextValue {
  getTableConfig: (tableId: string) => ResolvedTableColumn[];
  getVisibleColumns: (tableId: string) => ResolvedTableColumn[];
  isColumnVisible: (tableId: string, columnKey: string) => boolean;
  getColumnLabel: (tableId: string, columnKey: string, fallback?: string) => string;
  getColumnAlign: (tableId: string, columnKey: string) => "left" | "center" | "right";
  getTableDensity: (tableId: string) => TableDensity;
  getTablePageSize: (tableId: string) => number;
  getShowRowNumbers: (tableId: string) => boolean;
  getZebraStriping: (tableId: string) => boolean;
  setColumnVisibility: (tableId: string, columnKey: string, visible: boolean) => void;
  setColumnLabel: (tableId: string, columnKey: string, label: string, immediate?: boolean) => void;
  setColumnAlign: (tableId: string, columnKey: string, align: "left" | "center" | "right") => void;
  moveColumnOrder: (tableId: string, columnKey: string, direction: "up" | "down") => void;
  setColumnOrder: (tableId: string, orderedKeys: string[]) => void;
  setTableDensity: (tableId: string, density: TableDensity) => void;
  setTablePageSize: (tableId: string, pageSize: number) => void;
  setShowRowNumbers: (tableId: string, show: boolean) => void;
  setZebraStriping: (tableId: string, zebra: boolean) => void;
  resetTableToDefaults: (tableId: string) => void;
  resetAllTablesToDefaults: () => void;
  isSaving: boolean;
}

export const TableCustomizationContext =
  createContext<TableCustomizationContextValue | null>(null);

export function useTableCustomizationContext(): TableCustomizationContextValue {
  const ctx = useContext(TableCustomizationContext);
  if (!ctx) {
    throw new Error(
      "useTableCustomizationContext must be used within TableCustomizationProvider"
    );
  }
  return ctx;
}

export function useTableCustomizationContextOrNull(): TableCustomizationContextValue | null {
  return useContext(TableCustomizationContext);
}

/**
 * Hook to consume customization settings for a specific datatable.
 * Works seamlessly even outside TableCustomizationProvider with safe built-in defaults.
 */
export function useTableCustomization(tableId: string) {
  const ctx = useTableCustomizationContextOrNull();
  const def: TableDefinition | undefined = TABLE_REGISTRY[tableId];

  const columns: ResolvedTableColumn[] = useMemo(() => {
    if (ctx) {
      return ctx.getTableConfig(tableId);
    }
    if (!def) return [];
    return def.columns.map((c) => ({
      key: c.key,
      label: c.defaultLabel,
      defaultLabel: c.defaultLabel,
      customLabel: undefined,
      visible: c.defaultVisible !== false,
      defaultVisible: c.defaultVisible !== false,
      canHide: c.canHide !== false,
      order: c.defaultOrder,
      defaultOrder: c.defaultOrder,
      align: c.defaultAlign ?? "left",
      sortable: c.sortable !== false,
    }));
  }, [ctx, tableId, def]);

  const visibleColumns: ResolvedTableColumn[] = useMemo(() => {
    return columns.filter((c) => c.visible);
  }, [columns]);

  const density: TableDensity = useMemo(() => {
    if (ctx) {
      return ctx.getTableDensity(tableId);
    }
    return def?.defaultDensity ?? "comfortable";
  }, [ctx, tableId, def]);

  const densityStyles = useMemo(() => computeDensityStyles(density), [density]);

  const pageSize: number = useMemo(() => {
    if (ctx) {
      return ctx.getTablePageSize(tableId);
    }
    return def?.defaultPageSize ?? 20;
  }, [ctx, tableId, def]);

  const showRowNumbers: boolean = useMemo(() => {
    if (ctx) {
      return ctx.getShowRowNumbers(tableId);
    }
    return def?.supportsRowNumbers !== false;
  }, [ctx, tableId, def]);

  const zebraStriping: boolean = useMemo(() => {
    if (ctx) {
      return ctx.getZebraStriping(tableId);
    }
    return def?.supportsZebra !== false;
  }, [ctx, tableId, def]);

  const isColumnVisible = useMemo(() => {
    return (columnKey: string) => {
      if (ctx) return ctx.isColumnVisible(tableId, columnKey);
      const found = def?.columns.find((c) => c.key === columnKey);
      return found ? found.defaultVisible !== false : true;
    };
  }, [ctx, tableId, def]);

  const getColumnLabel = useMemo(() => {
    return (columnKey: string, fallback?: string) => {
      if (ctx) return ctx.getColumnLabel(tableId, columnKey, fallback);
      const found = def?.columns.find((c) => c.key === columnKey);
      return found?.defaultLabel ?? fallback ?? columnKey;
    };
  }, [ctx, tableId, def]);

  const getColumnAlign = useMemo(() => {
    return (columnKey: string) => {
      if (ctx) return ctx.getColumnAlign(tableId, columnKey);
      const found = def?.columns.find((c) => c.key === columnKey);
      return found?.defaultAlign ?? "left";
    };
  }, [ctx, tableId, def]);

  return {
    columns,
    visibleColumns,
    density,
    densityStyles,
    pageSize,
    showRowNumbers,
    zebraStriping,
    isColumnVisible,
    getColumnLabel,
    getColumnAlign,
    setColumnVisibility: ctx ? (colKey: string, visible: boolean) => ctx.setColumnVisibility(tableId, colKey, visible) : () => {},
    setColumnLabel: ctx ? (colKey: string, label: string, immediate?: boolean) => ctx.setColumnLabel(tableId, colKey, label, immediate) : () => {},
    setColumnAlign: ctx ? (colKey: string, align: "left" | "center" | "right") => ctx.setColumnAlign(tableId, colKey, align) : () => {},
    moveColumnOrder: ctx ? (colKey: string, direction: "up" | "down") => ctx.moveColumnOrder(tableId, colKey, direction) : () => {},
    setColumnOrder: ctx ? (keys: string[]) => ctx.setColumnOrder(tableId, keys) : () => {},
    setTableDensity: ctx ? (d: TableDensity) => ctx.setTableDensity(tableId, d) : () => {},
    setTablePageSize: ctx ? (s: number) => ctx.setTablePageSize(tableId, s) : () => {},
    setShowRowNumbers: ctx ? (show: boolean) => ctx.setShowRowNumbers(tableId, show) : () => {},
    setZebraStriping: ctx ? (z: boolean) => ctx.setZebraStriping(tableId, z) : () => {},
    resetTableToDefaults: ctx ? () => ctx.resetTableToDefaults(tableId) : () => {},
  };
}
