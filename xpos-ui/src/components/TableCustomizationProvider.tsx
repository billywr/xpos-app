import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectOrgId } from "@/store/selectors/orgContextSelectors";
import { useNavVisibilityContextOrNull } from "@/contexts/NavVisibilityContext";
import {
  TableCustomizationContext,
  type ResolvedTableColumn,
  type TableDensity,
  type TableCustomizationContextValue,
} from "@/contexts/TableCustomizationContext";
import {
  TABLE_REGISTRY,
  type TableDefinition,
} from "@/config/tableCustomizationRegistry";

interface LocalTableCustomizationState {
  visibility: Record<string, boolean>;
  labels: Record<string, string>;
}

function getLocalStorageKey(orgId: string | null): string {
  return `xpos_table_customization_${orgId || "global"}`;
}

function loadLocalState(orgId: string | null): LocalTableCustomizationState {
  try {
    const raw = localStorage.getItem(getLocalStorageKey(orgId));
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        visibility: parsed.visibility ?? {},
        labels: parsed.labels ?? {},
      };
    }
  } catch {
    /* ignore */
  }
  return { visibility: {}, labels: {} };
}

function saveLocalState(
  orgId: string | null,
  state: LocalTableCustomizationState
) {
  try {
    localStorage.setItem(getLocalStorageKey(orgId), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function TableCustomizationProvider({ children }: { children: ReactNode }) {
  const orgId = useAppSelector(selectOrgId);
  const navCtx = useNavVisibilityContextOrNull();

  // Local state as fast cache / offline fallback
  const [localCustomization, setLocalCustomization] =
    useState<LocalTableCustomizationState>(() => loadLocalState(orgId));

  // Reload local state when orgId changes
  useEffect(() => {
    setLocalCustomization(loadLocalState(orgId));
  }, [orgId]);

  const pendingLabelUpdatesRef = useRef<Record<string, string>>({});
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (
        debounceTimerRef.current &&
        Object.keys(pendingLabelUpdatesRef.current).length > 0
      ) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
        const updates = { ...pendingLabelUpdatesRef.current };
        pendingLabelUpdatesRef.current = {};
        (Object.entries(updates) as [string, string][]).forEach(([k, v]) => {
          navCtx?.setAdminLabel(k, v);
        });
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [navCtx]);

  // Combined visibility: local customization takes precedence for the active session, else backend
  const combinedVisibility = useMemo(() => {
    const backendVis = navCtx?.adminVisibility ?? {};
    return { ...backendVis, ...localCustomization.visibility };
  }, [navCtx?.adminVisibility, localCustomization.visibility]);

  // Combined labels: local customization takes precedence for the active session, else backend
  const combinedLabels = useMemo(() => {
    const backendLabels = navCtx?.adminLabels ?? {};
    return { ...backendLabels, ...localCustomization.labels };
  }, [navCtx?.adminLabels, localCustomization.labels]);

  const persistChange = useCallback(
    (
      newVisDelta?: Record<string, boolean>,
      newLabelsDelta?: Record<string, string>,
      immediateRemoteSync = false
    ) => {
      // 1. Update local cache immediately
      setLocalCustomization((prev) => {
        const nextVis = { ...prev.visibility, ...newVisDelta };
        const nextLabels = { ...prev.labels, ...newLabelsDelta };
        saveLocalState(orgId, { visibility: nextVis, labels: nextLabels });
        return { visibility: nextVis, labels: nextLabels };
      });

      // 2. Persist to backend if nav context is available
      if (navCtx) {
        if (newVisDelta) {
          Object.entries(newVisDelta).forEach(([k, v]) => {
            navCtx.setAdminVisible(k, v);
          });
        }
        if (newLabelsDelta) {
          Object.assign(pendingLabelUpdatesRef.current, newLabelsDelta);

          const flushLabels = () => {
            const updates = { ...pendingLabelUpdatesRef.current };
            pendingLabelUpdatesRef.current = {};
            (Object.entries(updates) as [string, string][]).forEach(([k, v]) => {
              navCtx.setAdminLabel(k, v);
            });
          };

          if (immediateRemoteSync) {
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
              debounceTimerRef.current = null;
            }
            flushLabels();
          } else {
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = setTimeout(flushLabels, 1500);
          }
        }
      }
    },
    [navCtx, orgId]
  );

  const getTableConfig = useCallback(
    (tableId: string): ResolvedTableColumn[] => {
      const def: TableDefinition | undefined = TABLE_REGISTRY[tableId];
      if (!def) return [];

      // Check if there is a custom ordering stored in labels
      const orderKey = `table.${tableId}.order`;
      const orderString = combinedLabels[orderKey];
      const customOrderedKeys = orderString
        ? orderString.split(",").map((k) => k.trim()).filter(Boolean)
        : null;

      const resolved = def.columns.map((c) => {
        const visKey = `table.${tableId}.${c.key}.visible`;
        const labelKey = `table.${tableId}.${c.key}.label`;
        const alignKey = `table.${tableId}.${c.key}.align`;

        // Visibility
        let visible = c.defaultVisible !== false;
        if (visKey in combinedVisibility) {
          visible = combinedVisibility[visKey];
        }

        // Custom Label
        const customLabel =
          labelKey in combinedLabels && combinedLabels[labelKey] !== ""
            ? combinedLabels[labelKey]
            : undefined;
        const label = customLabel?.trim() || c.defaultLabel;

        // Custom Alignment
        let align: "left" | "center" | "right" = c.defaultAlign ?? "left";
        if (alignKey in combinedLabels && combinedLabels[alignKey]) {
          const val = combinedLabels[alignKey];
          if (val === "left" || val === "center" || val === "right") {
            align = val;
          }
        }

        // Order
        let order = c.defaultOrder;
        if (customOrderedKeys) {
          const idx = customOrderedKeys.indexOf(c.key);
          if (idx !== -1) {
            order = idx + 1;
          } else {
            order = customOrderedKeys.length + c.defaultOrder;
          }
        }

        return {
          key: c.key,
          label,
          defaultLabel: c.defaultLabel,
          customLabel,
          visible,
          defaultVisible: c.defaultVisible !== false,
          canHide: c.canHide !== false,
          order,
          defaultOrder: c.defaultOrder,
          align,
          defaultAlign: c.defaultAlign ?? "left",
          sortable: c.sortable !== false,
        };
      });

      // Sort by order ascending
      return resolved.sort((a, b) => a.order - b.order);
    },
    [combinedVisibility, combinedLabels]
  );

  const getVisibleColumns = useCallback(
    (tableId: string): ResolvedTableColumn[] => {
      return getTableConfig(tableId).filter((c) => c.visible);
    },
    [getTableConfig]
  );

  const isColumnVisible = useCallback(
    (tableId: string, columnKey: string): boolean => {
      const visKey = `table.${tableId}.${columnKey}.visible`;
      if (visKey in combinedVisibility) {
        return combinedVisibility[visKey];
      }
      const def = TABLE_REGISTRY[tableId];
      const col = def?.columns.find((c) => c.key === columnKey);
      return col ? col.defaultVisible !== false : true;
    },
    [combinedVisibility]
  );

  const getColumnLabel = useCallback(
    (tableId: string, columnKey: string, fallback?: string): string => {
      const labelKey = `table.${tableId}.${columnKey}.label`;
      const custom = combinedLabels[labelKey]?.trim();
      if (custom) return custom;
      if (fallback) return fallback;
      const def = TABLE_REGISTRY[tableId]?.columns.find((c) => c.key === columnKey);
      return def?.defaultLabel || columnKey;
    },
    [combinedLabels]
  );

  const getColumnAlign = useCallback(
    (tableId: string, columnKey: string): "left" | "center" | "right" => {
      const alignKey = `table.${tableId}.${columnKey}.align`;
      const val = combinedLabels[alignKey];
      if (val === "left" || val === "center" || val === "right") {
        return val;
      }
      const def = TABLE_REGISTRY[tableId]?.columns.find((c) => c.key === columnKey);
      return def?.defaultAlign ?? "left";
    },
    [combinedLabels]
  );

  const getTableDensity = useCallback(
    (tableId: string): TableDensity => {
      const densityKey = `table.${tableId}.density`;
      const val = combinedLabels[densityKey];
      if (val === "compact" || val === "comfortable" || val === "spacious") {
        return val;
      }
      return TABLE_REGISTRY[tableId]?.defaultDensity ?? "comfortable";
    },
    [combinedLabels]
  );

  const getTablePageSize = useCallback(
    (tableId: string): number => {
      const sizeKey = `table.${tableId}.pageSize`;
      const raw = combinedLabels[sizeKey];
      if (raw) {
        const parsed = parseInt(raw, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
      return TABLE_REGISTRY[tableId]?.defaultPageSize ?? 20;
    },
    [combinedLabels]
  );

  const getShowRowNumbers = useCallback(
    (tableId: string): boolean => {
      const rowKey = `table.${tableId}.showRowNumbers`;
      if (rowKey in combinedVisibility) {
        return combinedVisibility[rowKey];
      }
      return TABLE_REGISTRY[tableId]?.supportsRowNumbers !== false;
    },
    [combinedVisibility]
  );

  const getZebraStriping = useCallback(
    (tableId: string): boolean => {
      const zebraKey = `table.${tableId}.zebra`;
      if (zebraKey in combinedVisibility) {
        return combinedVisibility[zebraKey];
      }
      return TABLE_REGISTRY[tableId]?.supportsZebra !== false;
    },
    [combinedVisibility]
  );

  const setColumnVisibility = useCallback(
    (tableId: string, columnKey: string, visible: boolean) => {
      const visKey = `table.${tableId}.${columnKey}.visible`;
      persistChange({ [visKey]: visible });
    },
    [persistChange]
  );

  const setColumnLabel = useCallback(
    (tableId: string, columnKey: string, label: string, immediate = false) => {
      const labelKey = `table.${tableId}.${columnKey}.label`;
      persistChange(undefined, { [labelKey]: label }, immediate);
    },
    [persistChange]
  );

  const setColumnAlign = useCallback(
    (tableId: string, columnKey: string, align: "left" | "center" | "right") => {
      const alignKey = `table.${tableId}.${columnKey}.align`;
      persistChange(undefined, { [alignKey]: align }, true);
    },
    [persistChange]
  );

  const setColumnOrder = useCallback(
    (tableId: string, orderedKeys: string[]) => {
      const orderKey = `table.${tableId}.order`;
      persistChange(undefined, { [orderKey]: orderedKeys.join(",") }, true);
    },
    [persistChange]
  );

  const moveColumnOrder = useCallback(
    (tableId: string, columnKey: string, direction: "up" | "down") => {
      const cols = getTableConfig(tableId);
      const keys = cols.map((c) => c.key);
      const idx = keys.indexOf(columnKey);
      if (idx === -1) return;

      if (direction === "up" && idx > 0) {
        const temp = keys[idx - 1];
        keys[idx - 1] = keys[idx];
        keys[idx] = temp;
        setColumnOrder(tableId, keys);
      } else if (direction === "down" && idx < keys.length - 1) {
        const temp = keys[idx + 1];
        keys[idx + 1] = keys[idx];
        keys[idx] = temp;
        setColumnOrder(tableId, keys);
      }
    },
    [getTableConfig, setColumnOrder]
  );

  const setTableDensity = useCallback(
    (tableId: string, density: TableDensity) => {
      const densityKey = `table.${tableId}.density`;
      persistChange(undefined, { [densityKey]: density }, true);
    },
    [persistChange]
  );

  const setTablePageSize = useCallback(
    (tableId: string, pageSize: number) => {
      const sizeKey = `table.${tableId}.pageSize`;
      persistChange(undefined, { [sizeKey]: String(pageSize) }, true);
    },
    [persistChange]
  );

  const setShowRowNumbers = useCallback(
    (tableId: string, show: boolean) => {
      const rowKey = `table.${tableId}.showRowNumbers`;
      persistChange({ [rowKey]: show });
    },
    [persistChange]
  );

  const setZebraStriping = useCallback(
    (tableId: string, zebra: boolean) => {
      const zebraKey = `table.${tableId}.zebra`;
      persistChange({ [zebraKey]: zebra });
    },
    [persistChange]
  );

  const resetTableToDefaults = useCallback(
    (tableId: string) => {
      const def = TABLE_REGISTRY[tableId];
      if (!def) return;

      const newVis: Record<string, boolean> = {};
      const newLabels: Record<string, string> = {};

      def.columns.forEach((c) => {
        newVis[`table.${tableId}.${c.key}.visible`] = c.defaultVisible !== false;
        newLabels[`table.${tableId}.${c.key}.label`] = "";
        newLabels[`table.${tableId}.${c.key}.align`] = "";
      });
      newLabels[`table.${tableId}.order`] = "";
      newLabels[`table.${tableId}.density`] = "";
      newLabels[`table.${tableId}.pageSize`] = "";
      newVis[`table.${tableId}.showRowNumbers`] = def.supportsRowNumbers !== false;
      newVis[`table.${tableId}.zebra`] = def.supportsZebra !== false;

      persistChange(newVis, newLabels, true);
    },
    [persistChange]
  );

  const resetAllTablesToDefaults = useCallback(() => {
    const newVis: Record<string, boolean> = {};
    const newLabels: Record<string, string> = {};

    Object.values(TABLE_REGISTRY).forEach((def) => {
      def.columns.forEach((c) => {
        newVis[`table.${def.id}.${c.key}.visible`] = c.defaultVisible !== false;
        newLabels[`table.${def.id}.${c.key}.label`] = "";
        newLabels[`table.${def.id}.${c.key}.align`] = "";
      });
      newLabels[`table.${def.id}.order`] = "";
      newLabels[`table.${def.id}.density`] = "";
      newLabels[`table.${def.id}.pageSize`] = "";
      newVis[`table.${def.id}.showRowNumbers`] = def.supportsRowNumbers !== false;
      newVis[`table.${def.id}.zebra`] = def.supportsZebra !== false;
    });

    persistChange(newVis, newLabels, true);
  }, [persistChange]);

  const value: TableCustomizationContextValue = useMemo(
    () => ({
      getTableConfig,
      getVisibleColumns,
      isColumnVisible,
      getColumnLabel,
      getColumnAlign,
      getTableDensity,
      getTablePageSize,
      getShowRowNumbers,
      getZebraStriping,
      setColumnVisibility,
      setColumnLabel,
      setColumnAlign,
      moveColumnOrder,
      setColumnOrder,
      setTableDensity,
      setTablePageSize,
      setShowRowNumbers,
      setZebraStriping,
      resetTableToDefaults,
      resetAllTablesToDefaults,
      isSaving: navCtx?.isSaving ?? false,
    }),
    [
      getTableConfig,
      getVisibleColumns,
      isColumnVisible,
      getColumnLabel,
      getColumnAlign,
      getTableDensity,
      getTablePageSize,
      getShowRowNumbers,
      getZebraStriping,
      setColumnVisibility,
      setColumnLabel,
      setColumnAlign,
      moveColumnOrder,
      setColumnOrder,
      setTableDensity,
      setTablePageSize,
      setShowRowNumbers,
      setZebraStriping,
      resetTableToDefaults,
      resetAllTablesToDefaults,
      navCtx?.isSaving,
    ]
  );

  return (
    <TableCustomizationContext.Provider value={value}>
      {children}
    </TableCustomizationContext.Provider>
  );
}
