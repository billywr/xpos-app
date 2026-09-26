import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ActivityIndicator,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/context/ToastContext";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  ClipboardCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  GitCompare,
  X,
} from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useOrg } from "@/context/OrgContext";
import {
  fetchStdStockCountSheet,
  fetchStdStockCountSalesPreview,
  fetchStdStockCountReconcilePreview,
} from "@/api/stdStockCount";
import { stockCountRepository, LocalStockCountRow } from "@/repositories/stockCountRepository";
import { useSyncStatus } from "@/services/useSyncStatus";
import {
  calcTotalStock,
  normalizeClosingQty,
  calcImpliedSold,
  calcQtyToRecord,
  calcLineRevenue,
  roundHalfUp,
} from "@/services/mathEngine";
import { formatCurrency, formatQty, formatQtyVariance } from "@/utils/formatCurrency";
import { haptics } from "@/utils/haptics";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { DatePickerModal } from "@/components/ui/DatePickerModal";
import { AnimatedModalBackdrop } from "@/components/ui/AnimatedModalBackdrop";

// ---------------------------------------------------------------------------
// Skeleton card that mirrors the real stock-count row layout
// ---------------------------------------------------------------------------
const StockRowSkeleton: React.FC = () => (
  <View
    style={{
      padding: 8,
      borderRadius: 16,
      backgroundColor: "transparent",
      marginBottom: 8,
    }}
  >
    <Card style={{ padding: 8 }}>
      {/* name + price row */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 }}>
        <SkeletonBlock width="55%" height={13} radius={6} />
        <SkeletonBlock width={50} height={11} radius={5} />
      </View>
      {/* 6-column metrics row */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 4 }}>
        {[36, 36, 36, 62, 36, 50].map((w, i) => (
          <View key={i} style={{ alignItems: "center", width: w }}>
            <SkeletonBlock width={w * 0.7} height={9} radius={4} style={{ marginBottom: 4 }} />
            <SkeletonBlock width={w} height={30} radius={6} />
          </View>
        ))}
      </View>
    </Card>
  </View>
);


function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const StockCountScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { token } = useAuth();
  const { orgId, branchId, terminalId } = useOrg();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { isOnline, pendingCount, syncingCount, triggerSync } = useSyncStatus();

  const [date, setDate] = useState<Date>(new Date());
  const dateStr = useMemo(() => toDateString(date), [date]);
  const isToday = useMemo(() => dateStr === toDateString(new Date()), [dateStr]);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const handlePickDate = (picked: string) => {
    const [y, m, d] = picked.split("-").map(Number);
    setDate(new Date(y, m - 1, d));
    setDatePickerOpen(false);
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [showZeroStockItems, setShowZeroStockItems] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // Local draft of edited closing stocks
  const [closingDrafts, setClosingDrafts] = useState<Record<string, string>>({});
  const closingDraftsRef = useRef<Record<string, string>>({});
  closingDraftsRef.current = closingDrafts;
  const [savingItemIds, setSavingItemIds] = useState<Set<string>>(new Set());

  // Input selection tracking to place cursor on right side without highlighting
  const [activeSelection, setActiveSelection] = useState<{
    itemId: string;
    selection: { start: number; end: number };
  } | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);

  // Record Sales & Reconcile Modals
  const [recordSalesOpen, setRecordSalesOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [soldModalOpen, setSoldModalOpen] = useState(false);

  // Auto-save debounce timer
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const AUTO_SAVE_DEBOUNCE_MS = 2500;
  const BLUR_SAVE_DEBOUNCE_MS = 150;

  // Fetch sheet query - reads directly from local SQLite (<10ms) with cold-start remote fallback
  const {
    data: sheetData,
    isLoading: sheetLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["local-stock-count-sheet", orgId, branchId, dateStr, token],
    queryFn: () => stockCountRepository.getSheet(orgId!, branchId!, dateStr, token),
    enabled: Boolean(orgId && branchId),
  });

  // Background hydration from server without blocking UI
  useEffect(() => {
    if (!token || !orgId || !branchId) return;
    let active = true;

    fetchStdStockCountSheet(token, orgId, branchId, dateStr)
      .then(async (remoteSheet) => {
        if (!active || !remoteSheet) return;
        await stockCountRepository.hydrateFromRemote(orgId, branchId, remoteSheet);
        void queryClient.invalidateQueries({
          queryKey: ["local-stock-count-sheet", orgId, branchId, dateStr],
        });
      })
      .catch(() => {
        // Silently caught when offline or server unreachable
      });

    return () => {
      active = false;
    };
  }, [token, orgId, branchId, dateStr, queryClient]);

  // Sales preview query - computes directly or checks remote
  const {
    data: salesPreview,
    refetch: refetchSalesPreview,
    isFetching: isFetchingSalesPreview,
  } = useQuery({
    queryKey: ["std-stock-count-sales-preview", orgId, branchId, dateStr],
    queryFn: async () => {
      if (isOnline && token) {
        try {
          return await fetchStdStockCountSalesPreview(token, orgId!, branchId!, dateStr);
        } catch {}
      }
      return stockCountRepository.getSalesPreview(orgId!, branchId!, dateStr);
    },
    enabled: Boolean(orgId && branchId),
  });

  // Reconcile preview query - computes directly or checks remote
  const { data: reconcilePreview, refetch: refetchReconcilePreview } = useQuery({
    queryKey: ["std-stock-count-reconcile-preview", orgId, branchId, dateStr],
    queryFn: async () => {
      if (isOnline && token) {
        try {
          return await fetchStdStockCountReconcilePreview(token, orgId!, branchId!, dateStr);
        } catch {}
      }
      return stockCountRepository.getReconcilePreview(orgId!, branchId!, dateStr);
    },
    enabled: Boolean(orgId && branchId && isToday),
  });

  // Record Sales mutation (local-first with outbox sync)
  const recordSalesMutation = useMutation({
    mutationFn: () =>
      stockCountRepository.recordSales(
        orgId!,
        branchId!,
        terminalId ?? "term-1",
        dateStr
      ),
    onSuccess: () => {
      haptics.success();
      setRecordSalesOpen(false);
      void queryClient.invalidateQueries({
        queryKey: ["local-stock-count-sheet", orgId, branchId, dateStr],
      });
      void refetch();
      void refetchSalesPreview();
      void refetchReconcilePreview();
      toast.success("Sales recorded (queued for sync).");
    },
    onError: (err: any) => {
      haptics.error();
      toast.error(err?.data?.message ?? "Failed to record sales.", "Error");
    },
  });

  // Reconcile mutation (local-first with outbox sync)
  const reconcileMutation = useMutation({
    mutationFn: () =>
      stockCountRepository.reconcileInventory(orgId!, branchId!, dateStr),
    onSuccess: () => {
      haptics.success();
      setReconcileOpen(false);
      void queryClient.invalidateQueries({
        queryKey: ["local-stock-count-sheet", orgId, branchId, dateStr],
      });
      void refetch();
      void refetchReconcilePreview();
      toast.success("Inventory reconciled (queued for sync).");
    },
    onError: (err: any) => {
      haptics.error();
      toast.error(err?.data?.message ?? "Failed to reconcile inventory.", "Error");
    },
  });

  // Save execution - instantaneous local SQLite commit (<10ms)
  const executeSave = useCallback(
    async (itemId?: string) => {
      if (!orgId || !branchId) return;
      const drafts = closingDraftsRef.current;
      const countsToSave: { itemId: string; closingStock: number }[] = [];
      const itemIdsToMark = new Set<string>();

      if (itemId && drafts[itemId] !== undefined) {
        const val = Number(drafts[itemId]);
        if (!Number.isNaN(val) && val >= 0) {
          countsToSave.push({ itemId, closingStock: val });
          itemIdsToMark.add(itemId);
        }
      } else {
        Object.entries(drafts).forEach(([id, strVal]) => {
          const val = Number(strVal);
          if (!Number.isNaN(val) && val >= 0) {
            countsToSave.push({ itemId: id, closingStock: val });
            itemIdsToMark.add(id);
          }
        });
      }

      if (countsToSave.length > 0) {
        setSavingItemIds(itemIdsToMark);
        try {
          await stockCountRepository.saveClosingCount(orgId, branchId, dateStr, countsToSave);
          haptics.selection();
          const savedIds = new Set(countsToSave.map((c) => c.itemId));
          setClosingDrafts((prev) => {
            const next = { ...prev };
            savedIds.forEach((id) => delete next[id]);
            closingDraftsRef.current = next;
            return next;
          });
          setSavingItemIds(new Set());
          void queryClient.invalidateQueries({
            queryKey: ["local-stock-count-sheet", orgId, branchId, dateStr],
          });
          void refetchSalesPreview();
          void refetchReconcilePreview();
        } catch {
          haptics.error();
          setSavingItemIds(new Set());
          toast.error("Could not persist count locally.", "Save Failed");
        }
      }
    },
    [orgId, branchId, dateStr, queryClient, refetchSalesPreview, refetchReconcilePreview, toast]
  );

  // Handle typing closing stock
  const handleClosingChange = (itemId: string, val: string) => {
    setClosingDrafts((prev) => {
      const next = { ...prev, [itemId]: val };
      closingDraftsRef.current = next;
      return next;
    });

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      executeSave(itemId);
    }, AUTO_SAVE_DEBOUNCE_MS);
  };

  // Fast auto-save on blur (150ms)
  const handleClosingBlur = (itemId: string) => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      executeSave(itemId);
    }, BLUR_SAVE_DEBOUNCE_MS);
  };

  // Open Record Sales preview with pending draft flush and fresh preview refetch
  const handleOpenRecordSales = () => {
    haptics.light();
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (Object.keys(closingDrafts).length > 0) {
      executeSave();
    }
    setRecordSalesOpen(true);
    void refetchSalesPreview();
  };

  // Open Reconcile preview with pending draft flush and fresh preview refetch
  const handleOpenReconcile = () => {
    haptics.light();
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (Object.keys(closingDrafts).length > 0) {
      executeSave();
    }
    setReconcileOpen(true);
    if (isToday) {
      void refetchReconcilePreview();
    }
  };

  // Manual refresh inside record sales preview modal
  const handleRefreshPreview = () => {
    haptics.light();
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (Object.keys(closingDrafts).length > 0) {
      executeSave();
    }
    void refetchSalesPreview();
  };

  // Manual refresh from toolbar button and pull-to-refresh
  const handleManualRefresh = async () => {
    haptics.light();
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (Object.keys(closingDrafts).length > 0) {
      executeSave();
    }
    setIsManualRefreshing(true);
    try {
      if (token && orgId && branchId) {
        const remoteSheet = await fetchStdStockCountSheet(token, orgId, branchId, dateStr);
        if (remoteSheet && remoteSheet.rows) {
          await stockCountRepository.hydrateFromRemote(orgId, branchId, remoteSheet);
        }
      }
    } catch (err) {
      console.warn("[StockCountScreen] Manual refresh remote fetch warning:", err);
    } finally {
      setIsManualRefreshing(false);
      void refetch();
      void refetchSalesPreview();
      if (isToday) {
        void refetchReconcilePreview();
      }
    }
  };

  // Date Navigation
  const changeDate = (days: number) => {
    haptics.light();
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    setDate(next);
    setClosingDrafts({});
  };

  // Filtered rows: hide items with zero total stock (opening + added + addedToday <= 0),
  // unless showZeroStockItems is true or there is an active closing count recorded or drafted > 0.
  const filteredRows = useMemo(() => {
    const rows = sheetData?.rows ?? [];
    const activeRows = rows.filter((r) => {
      if (showZeroStockItems) return true;
      const totalStock = r.openingStock + r.addedStock + r.addedTodayStock;
      const draftVal = closingDrafts[r.itemId];
      const hasClosingDraft = draftVal !== undefined && draftVal.trim() !== "" && Number(draftVal) > 0;
      const hasRecordedClosing = r.closingStock !== null && r.closingStock > 0;
      return totalStock > 0 || hasClosingDraft || hasRecordedClosing;
    });

    if (!searchQuery.trim()) return activeRows;
    const q = searchQuery.toLowerCase().trim();
    return activeRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.sku && r.sku.toLowerCase().includes(q))
    );
  }, [sheetData?.rows, closingDrafts, searchQuery, showZeroStockItems]);

  // Totals calculations
  const totals = useMemo(() => {
    let totalItems = 0;
    let totalSold = 0;
    let totalRevenue = 0;
    const soldItems: {
      itemId: string;
      name: string;
      unitPrice: number;
      unitsSold: number;
      totalValue: number;
    }[] = [];

    (sheetData?.rows ?? []).forEach((r) => {
      const totalStock = r.openingStock + r.addedStock + r.addedTodayStock;
      const draftVal = closingDrafts[r.itemId];
      const hasClosingDraft = draftVal !== undefined && draftVal.trim() !== "" && Number(draftVal) > 0;
      const hasRecordedClosing = r.closingStock !== null && r.closingStock > 0;
      if (totalStock <= 0 && !hasClosingDraft && !hasRecordedClosing) {
        return;
      }
      totalItems += 1;
      const closing =
        draftVal !== undefined && draftVal.trim() !== ""
          ? Number(draftVal)
          : r.closingStock;
      if (closing !== null && !Number.isNaN(closing)) {
        const sold = Math.max(0, Math.round((totalStock - closing) * 100) / 100);
        if (sold > 0) {
          soldItems.push({
            itemId: r.itemId,
            name: r.name,
            unitPrice: r.sellingPrice,
            unitsSold: sold,
            totalValue: sold * r.sellingPrice,
          });
        }
        totalSold += sold;
        totalRevenue += sold * r.sellingPrice;
      }
    });

    return { totalItems, totalSold, totalRevenue, soldItems };
  }, [sheetData?.rows, closingDrafts]);

  // Map of already recorded sales per item for today
  const alreadyRecordedByItem = useMemo(() => {
    const map: Record<string, number> = {};
    (salesPreview?.lines ?? []).forEach((line) => {
      map[line.itemId] = Number(line.alreadyRecorded) || 0;
    });
    return map;
  }, [salesPreview?.lines]);

  // Reactive sales to record calculation: (Total - Closing) - alreadyRecorded
  const reactiveSales = useMemo(() => {
    let totalQtyToRecord = 0;
    let totalRecorded = 0;

    (sheetData?.rows ?? []).forEach((r) => {
      const totalStock = r.openingStock + r.addedStock + r.addedTodayStock;
      const draftVal = closingDrafts[r.itemId];
      const closing =
        draftVal !== undefined && draftVal.trim() !== ""
          ? Number(draftVal)
          : r.closingStock;
      const already = alreadyRecordedByItem[r.itemId] ?? 0;
      totalRecorded += already;

      if (closing !== null && !Number.isNaN(closing)) {
        const implied = Math.max(0, Math.round((totalStock - closing) * 100) / 100);
        const diff = implied - already;
        const toRecord = diff > 0.001 ? Math.round(diff * 100) / 100 : 0;
        totalQtyToRecord += toRecord;
      }
    });

    return {
      totalQtyToRecord: Math.round(totalQtyToRecord * 100) / 100,
      totalRecorded: Math.round(totalRecorded * 100) / 100,
    };
  }, [sheetData?.rows, closingDrafts, alreadyRecordedByItem]);

  // Action button visibility
  const hasDrafts = Object.keys(closingDrafts).length > 0;
  const serverQty = Math.round((Number(salesPreview?.totalQtyToRecord) || 0) * 100) / 100;
  const totalQtyToRecord = hasDrafts
    ? (reactiveSales.totalQtyToRecord > 0 ? reactiveSales.totalQtyToRecord : serverQty)
    : serverQty;
  const itemsToReconcile = reconcilePreview?.itemsAdjusted ?? 0;
  const hasSavedClosings = (sheetData?.rows ?? []).some((r) => r.closingStock != null);
  const canRecord = totalQtyToRecord >= 1 && !sheetLoading;
  const canReconcile = itemsToReconcile > 0 && !sheetLoading && !reconcileMutation.isPending;
  const showReconcile = isToday && canReconcile;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        {/* Date Header Bar */}
        <View
          style={[
            styles.dateBar,
            { backgroundColor: colors.surface, borderBottomColor: colors.border },
          ]}
        >
        <TouchableOpacity
          onPress={() => changeDate(-1)}
          style={[styles.dateNavBtn, { backgroundColor: colors.surfaceRaised }]}
        >
          <ChevronLeft size={20} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            haptics.light();
            setDatePickerOpen(true);
          }}
          activeOpacity={0.7}
          style={styles.dateCenter}
        >
          <Calendar size={16} color={colors.primary} />
          <Text style={[styles.dateText, { color: colors.text }]}>
            {dateStr} {isToday ? "(Today)" : ""}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => changeDate(1)}
          disabled={isToday}
          style={[
            styles.dateNavBtn,
            {
              backgroundColor: colors.surfaceRaised,
              opacity: isToday ? 0.4 : 1,
            },
          ]}
        >
          <ChevronRight size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Search & Action Bar */}
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Input
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search…"
            leftIcon={<Search size={15} color={colors.textSubtle} />}
            containerStyle={{ marginBottom: 0 }}
            inputWrapperStyle={styles.searchInputWrapper}
            style={{ fontSize: 13 }}
          />
        </View>

        {/* Sync Status Badge */}
        <TouchableOpacity
          onPress={() => {
            haptics.light();
            triggerSync();
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Sync status"
          style={[
            styles.syncStatusPill,
            {
              backgroundColor: !isOnline
                ? (isDark ? "rgba(245, 158, 11, 0.2)" : "#fef3c7")
                : syncingCount > 0
                ? (isDark ? "rgba(59, 130, 246, 0.2)" : "#dbeafe")
                : pendingCount > 0
                ? (isDark ? "rgba(245, 158, 11, 0.2)" : "#fef3c7")
                : (isDark ? "rgba(16, 185, 129, 0.15)" : "#d1fae5"),
              borderColor: !isOnline
                ? colors.warning
                : syncingCount > 0
                ? colors.primary
                : pendingCount > 0
                ? colors.warning
                : colors.success,
            },
          ]}
        >
          {!isOnline ? (
            <Clock size={12} color={colors.warning} />
          ) : syncingCount > 0 ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : pendingCount > 0 ? (
            <Clock size={12} color={colors.warning} />
          ) : (
            <CheckCircle2 size={12} color={colors.success} />
          )}
          <Text
            style={[
              styles.syncStatusText,
              {
                color: !isOnline
                  ? colors.warning
                  : syncingCount > 0
                  ? colors.primary
                  : pendingCount > 0
                  ? colors.warning
                  : colors.success,
              },
            ]}
          >
            {!isOnline
              ? `${pendingCount}Q`
              : syncingCount > 0
              ? "Sync"
              : pendingCount > 0
              ? `${pendingCount}Q`
              : "Synced"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            haptics.light();
            setSoldModalOpen(true);
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="View items sold breakdown"
          style={[
            styles.totalSalesPill,
            {
              backgroundColor: colors.primaryLight,
              borderColor: colors.primary,
            },
          ]}
        >
          <Text style={[styles.totalSalesText, { color: colors.primary }]}>
            {formatCurrency(totals.totalRevenue)}
          </Text>
        </TouchableOpacity>

        {canRecord ? (
          <TouchableOpacity
            onPress={handleOpenRecordSales}
            activeOpacity={0.7}
            style={[
              styles.recordBtn,
              {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
                borderWidth: 0,
                opacity: 1,
              },
            ]}
          >
            <ClipboardCheck size={16} color="#ffffff" />
            <Text style={[styles.recordBtnText, { color: "#ffffff" }]}>
              {formatQty(totalQtyToRecord)}
            </Text>
          </TouchableOpacity>
        ) : null}

        {showReconcile ? (
          <TouchableOpacity
            onPress={handleOpenReconcile}
            activeOpacity={0.7}
            style={[
              styles.reconcileBtn,
              {
                backgroundColor: colors.warning,
                borderColor: colors.warning,
                borderWidth: 0,
                opacity: 1,
              },
            ]}
          >
            <RefreshCw size={16} color="#ffffff" />
            <Text style={[styles.recordBtnText, { color: "#ffffff" }]}>
              {itemsToReconcile}
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          onPress={handleManualRefresh}
          disabled={isRefetching || isManualRefreshing}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Refresh stock count sheet"
          style={[
            styles.refreshToolbarBtn,
            {
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.border,
            },
          ]}
        >
          {isRefetching || isManualRefreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <RefreshCw size={16} color={colors.text} />
          )}
        </TouchableOpacity>
      </View>

      {/* Sheet Items List */}
      {sheetLoading && !sheetData ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.listContent, { paddingTop: 10 }]}
          scrollEnabled={false}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <StockRowSkeleton key={i} />
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={filteredRows}
          extraData={[closingDrafts, savingItemIds, alreadyRecordedByItem, dateStr, focusedItemId, showZeroStockItems]}
          keyExtractor={(item) => item.itemId}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching || isManualRefreshing}
              onRefresh={handleManualRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          decelerationRate={Platform.OS === "ios" ? "normal" : 0.985}
          bounces={true}
          alwaysBounceVertical={true}
          overScrollMode="never"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          updateCellsBatchingPeriod={40}
          removeClippedSubviews={Platform.OS === "android"}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              {searchQuery ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No items match &quot;{searchQuery}&quot;.
                </Text>
              ) : (sheetData?.rows ?? []).length > 0 ? (
                <View style={{ alignItems: "center", paddingHorizontal: 16 }}>
                  <Text style={[styles.emptyText, { color: colors.textMuted, marginBottom: 12, textAlign: "center" }]}>
                    All {(sheetData?.rows ?? []).length} items have zero total stock today.
                  </Text>
                  <Button
                    title={showZeroStockItems ? "Hide Zero-Stock Items" : "Show All Items"}
                    variant="outline"
                    size="sm"
                    onPress={() => setShowZeroStockItems((prev) => !prev)}
                  />
                </View>
              ) : (
                <View style={{ alignItems: "center", paddingHorizontal: 16 }}>
                  <Text style={[styles.emptyText, { color: colors.textMuted, marginBottom: 12, textAlign: "center" }]}>
                    No stock count data found locally.
                  </Text>
                  <Button
                    title="Sync from Server"
                    variant="primary"
                    size="sm"
                    loading={isManualRefreshing}
                    onPress={handleManualRefresh}
                    icon={<RefreshCw size={14} color="#fff" />}
                  />
                </View>
              )}
            </View>
          }
          renderItem={({ item, index }) => {
            const totalStock =
              item.openingStock + item.addedStock + item.addedTodayStock;
            const draftVal = closingDrafts[item.itemId];
            const currentClosing =
              draftVal !== undefined
                ? draftVal
                : item.closingStock !== null
                ? String(item.closingStock)
                : "";
            const isSaving = savingItemIds.has(item.itemId);
            const isUnsaved =
              draftVal !== undefined &&
              String(draftVal) !== String(item.closingStock ?? "");
            const isFocused = focusedItemId === item.itemId;

            const closingNum = Number(currentClosing);
            const unitsSold =
              !Number.isNaN(closingNum) && currentClosing !== ""
                ? Math.max(0, totalStock - closingNum)
                : 0;
            const soldAmount = unitsSold * item.sellingPrice;
            const alreadyRecorded = alreadyRecordedByItem[item.itemId] ?? 0;
            const newToRecord = Math.max(0, unitsSold - alreadyRecorded);

            return (
              <Card style={styles.rowCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
                      {index + 1}. {item.name}
                    </Text>
                    <Text style={[styles.itemPrice, { color: colors.textSubtle }]}>
                      {formatCurrency(item.sellingPrice)}
                    </Text>
                  </View>
                  {isSaving || item.syncStatus === "SYNCING" ? (
                    <Badge label="Syncing…" variant="warning" size="sm" pulse />
                  ) : item.syncStatus === "PENDING" ? (
                    <Badge label="Queued" variant="warning" size="sm" />
                  ) : item.syncStatus === "FAILED" ? (
                    <Badge label="Failed" variant="danger" size="sm" />
                  ) : isUnsaved ? (
                    <Badge label="Unsaved" variant="danger" size="sm" />
                  ) : newToRecord > 0 ? (
                    <Badge label={`${formatQty(newToRecord)} to record`} variant="purple" size="sm" />
                  ) : alreadyRecorded > 0 && unitsSold === alreadyRecorded ? (
                    <Badge label="Recorded" variant="primary" size="sm" />
                  ) : item.closingStock !== null ? (
                    <Badge label="Saved" variant="neutral" size="sm" />
                  ) : null}
                </View>

                {/* Stock figures grid */}
                <View style={styles.metricsRow}>
                  <View style={styles.metricCol}>
                    <Text style={[styles.metricLabel, { color: colors.textSubtle }]}>
                      Open
                    </Text>
                    <View style={styles.metricValWrap}>
                      <Text style={[styles.metricVal, { color: colors.textMuted }]}>
                        {formatQty(item.openingStock)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.metricCol}>
                    <Text style={[styles.metricLabel, { color: colors.textSubtle }]}>
                      Added
                    </Text>
                    <View style={styles.metricValWrap}>
                      <Text style={[styles.metricVal, { color: colors.textMuted }]}>
                        {formatQty(item.addedStock + item.addedTodayStock)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.metricCol}>
                    <Text
                      style={[
                        styles.metricLabel,
                        styles.metricLabelTotal,
                        { color: isDark ? "#38bdf8" : "#0284c7" },
                      ]}
                    >
                      Total
                    </Text>
                    <View style={styles.metricValWrap}>
                      <Text
                        style={[
                          styles.metricValBold,
                          { color: colors.text, fontWeight: "800" },
                        ]}
                      >
                        {formatQty(totalStock)}
                      </Text>
                    </View>
                  </View>

                  {/* Closing Stock Input */}
                  <View style={styles.closingInputCol}>
                    <Text style={[styles.metricLabel, { color: colors.primary }]}>
                      Close
                    </Text>
                    <TextInput
                      value={currentClosing}
                      onChangeText={(val) => {
                        haptics.selection();
                        handleClosingChange(item.itemId, val);
                      }}
                      onBlur={() => {
                        setFocusedItemId(null);
                        handleClosingBlur(item.itemId);
                      }}
                      onSubmitEditing={() => executeSave(item.itemId)}
                      returnKeyType="done"
                      blurOnSubmit={true}
                      keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                      cursorColor={colors.primary}
                      selectionColor={isDark ? "rgba(16, 185, 129, 0.35)" : "rgba(5, 150, 105, 0.25)"}
                      selectTextOnFocus={false}
                      autoCorrect={false}
                      spellCheck={false}
                      autoCapitalize="none"
                      onFocus={(e: any) => {
                        setFocusedItemId(item.itemId);
                        haptics.light();
                        const len = currentClosing.length;
                        if (Platform.OS === "web" && e?.target?.setSelectionRange) {
                          try {
                            e.target.setSelectionRange(len, len);
                          } catch {}
                        }
                        setActiveSelection({
                          itemId: item.itemId,
                          selection: { start: len, end: len },
                        });
                      }}
                      onSelectionChange={() => {
                        if (activeSelection?.itemId === item.itemId) {
                          setActiveSelection(null);
                        }
                      }}
                      selection={
                        activeSelection?.itemId === item.itemId
                          ? activeSelection.selection
                          : undefined
                      }
                      placeholder="0"
                      placeholderTextColor={colors.textSubtle}
                      style={[
                        styles.closingInput,
                        {
                          backgroundColor: colors.surfaceRaised,
                          color: colors.text,
                          borderColor: isFocused
                            ? colors.primary
                            : isUnsaved
                            ? colors.warning
                            : colors.border,
                          shadowColor: isFocused ? colors.primary : "transparent",
                          shadowOpacity: isFocused ? 0.35 : 0,
                          shadowRadius: isFocused ? 4 : 0,
                          elevation: isFocused ? 2 : 0,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.metricCol}>
                    <Text style={[styles.metricLabel, { color: colors.primary }]}>
                      Sold
                    </Text>
                    <View style={styles.metricValWrap}>
                      <Text style={[styles.metricValSold, { color: colors.primary }]}>
                        {formatQty(unitsSold)}
                      </Text>
                    </View>
                    {alreadyRecorded > 0 ? (
                      <Text style={[styles.recordedSubtext, { color: colors.textSubtle }]}>
                        {newToRecord > 0 ? `+${formatQty(newToRecord)} new` : "all rec"}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.metricCol}>
                    <Text style={[styles.metricLabel, { color: colors.accent }]}>
                      Amt
                    </Text>
                    <View style={styles.metricValWrap}>
                      <Text style={[styles.metricValSold, { color: colors.accent }]}>
                        {formatCurrency(soldAmount)}
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* Record Sales Preview Modal */}
      <Modal
        visible={recordSalesOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setRecordSalesOpen(false)}
      >
        <AnimatedModalBackdrop
          style={styles.modalBackdrop}
          onPressBackdrop={() => setRecordSalesOpen(false)}
        >
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0 }]}>
                Record Sales Preview
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TouchableOpacity
                  onPress={handleRefreshPreview}
                  disabled={isFetchingSalesPreview}
                  style={[
                    styles.modalRefreshBtn,
                    {
                      backgroundColor: colors.surfaceRaised,
                      borderColor: colors.border,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  {isFetchingSalesPreview ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <RefreshCw size={13} color={colors.text} />
                  )}
                  <Text style={[styles.modalRefreshBtnText, { color: colors.text }]}>
                    Refresh
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setRecordSalesOpen(false)}
                  style={[styles.closeBtn, { backgroundColor: colors.surfaceRaised }]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
            {(() => {
              const previewLines = (salesPreview?.lines ?? []).filter(
                (l) => (Number(l.qtyToRecord) || 0) > 0.001
              );
              const hasLinesToRecord = previewLines.length > 0 && totalQtyToRecord >= 1;

              if (hasLinesToRecord) {
                return (
                  <>
                    <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
                      Create POS sales for {formatQty(totalQtyToRecord)} units sold (Total:{" "}
                      {formatCurrency(salesPreview?.totalValueToRecord ?? 0)}).
                    </Text>

                    <FlatList
                      data={previewLines}
                      keyExtractor={(l) => l.itemId}
                      style={{ maxHeight: 280, marginVertical: 12 }}
                      contentContainerStyle={{ paddingRight: 14 }}
                      renderItem={({ item }) => (
                        <View
                          style={[
                            styles.previewLine,
                            { borderBottomColor: colors.borderSubtle },
                          ]}
                        >
                          <Text style={[styles.previewName, { color: colors.text }]}>
                            {item.name}
                          </Text>
                          <Text style={[styles.previewQty, { color: colors.primary }]}>
                            {formatQty(item.qtyToRecord)} × {formatCurrency(item.unitPrice)} ={" "}
                            {formatCurrency(item.lineValue)}
                          </Text>
                        </View>
                      )}
                    />

                    <View style={styles.modalBtns}>
                      <Button
                        title="Cancel"
                        variant="secondary"
                        onPress={() => setRecordSalesOpen(false)}
                        style={{ flex: 1, marginRight: 8 }}
                      />
                      <Button
                        title="Confirm Record Sales"
                        loading={recordSalesMutation.isPending}
                        onPress={() => recordSalesMutation.mutate()}
                        style={{ flex: 1.4 }}
                      />
                    </View>
                  </>
                );
              }

              return (
                <View style={{ marginVertical: 12 }}>
                  <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
                    {reactiveSales.totalRecorded > 0
                      ? `All sales up to current closing counts are already recorded (${formatQty(reactiveSales.totalRecorded)} sold today). Enter new closing counts on the sheet to record additional sales.`
                      : "No new sales to record. Enter closing stock on the sheet to calculate units sold."}
                  </Text>

                  {(salesPreview?.lines.filter((l) => (Number(l.alreadyRecorded) || 0) > 0) ?? []).length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: colors.textSubtle,
                          marginBottom: 6,
                        }}
                      >
                        Already Recorded Today:
                      </Text>
                      <FlatList
                        data={
                          salesPreview?.lines.filter((l) => (Number(l.alreadyRecorded) || 0) > 0) ?? []
                        }
                        keyExtractor={(l) => l.itemId}
                        style={{ maxHeight: 200 }}
                        contentContainerStyle={{ paddingRight: 14 }}
                        renderItem={({ item }) => (
                          <View
                            style={[
                              styles.previewLine,
                              { borderBottomColor: colors.borderSubtle },
                            ]}
                          >
                            <Text style={[styles.previewName, { color: colors.text }]}>
                              {item.name}
                            </Text>
                            <Text style={[styles.previewQty, { color: colors.textMuted }]}>
                              {formatQty(item.alreadyRecorded)} rec
                            </Text>
                          </View>
                        )}
                      />
                    </View>
                  )}

                  <View style={[styles.modalBtns, { marginTop: 16 }]}>
                    <Button
                      title="Close"
                      variant="secondary"
                      onPress={() => setRecordSalesOpen(false)}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              );
            })()}
          </View>
        </AnimatedModalBackdrop>
      </Modal>

      {/* Reconcile Inventory Modal */}
      <Modal
        visible={reconcileOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setReconcileOpen(false)}
      >
        <AnimatedModalBackdrop
          style={styles.modalBackdrop}
          onPressBackdrop={() => setReconcileOpen(false)}
        >
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0 }]}>
                Reconcile Inventory
              </Text>
              <TouchableOpacity
                onPress={() => setReconcileOpen(false)}
                style={[styles.closeBtn, { backgroundColor: colors.surfaceRaised }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
              Adjust on-hand inventory balances to match closing counts for{" "}
              {itemsToReconcile} items.
            </Text>

            <FlatList
              data={reconcilePreview?.lines.filter((l) => l.variance !== 0) ?? []}
              keyExtractor={(l) => l.itemId}
              style={{ maxHeight: 300, marginVertical: 12 }}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.previewLine,
                    { borderBottomColor: colors.borderSubtle },
                  ]}
                >
                  <Text style={[styles.previewName, { color: colors.text }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.previewQty, { color: colors.warning }]}>
                    Close: {formatQty(item.closingStock)} · On-Hand: {formatQty(item.onHandQty)} · Var:{" "}
                    {formatQtyVariance(item.variance)}
                  </Text>
                </View>
              )}
            />

            <View style={styles.modalBtns}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setReconcileOpen(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Confirm Reconcile"
                variant="primary"
                loading={reconcileMutation.isPending}
                onPress={() => reconcileMutation.mutate()}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        </AnimatedModalBackdrop>
      </Modal>

      {/* Sold Items Breakdown Modal */}
      <Modal
        visible={soldModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSoldModalOpen(false)}
      >
        <AnimatedModalBackdrop
          style={styles.modalBackdrop}
          onPressBackdrop={() => setSoldModalOpen(false)}
        >
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0 }]}>
                  Items Sold
                </Text>
                <Badge
                  label={`${formatQty(totals.totalSold)} sold · ${formatCurrency(totals.totalRevenue)}`}
                  variant="primary"
                  size="sm"
                />
              </View>
              <TouchableOpacity
                onPress={() => setSoldModalOpen(false)}
                style={[styles.closeBtn, { backgroundColor: colors.surfaceRaised }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
              Breakdown of {totals.soldItems.length} items sold based on current stock count.
            </Text>

            {totals.soldItems.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                  No items sold yet. Enter closing counts below total stock.
                </Text>
              </View>
            ) : (
              <FlatList
                data={totals.soldItems}
                keyExtractor={(item) => item.itemId}
                style={{ maxHeight: 340, marginVertical: 8 }}
                contentContainerStyle={{ paddingRight: 14 }}
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.previewLine,
                      { borderBottomColor: colors.borderSubtle },
                    ]}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={[
                          styles.previewName,
                          { color: colors.text, flex: 1, marginRight: 8 },
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: colors.primary,
                        }}
                      >
                        {formatCurrency(item.totalValue)}
                      </Text>
                    </View>
                    <Text style={[styles.previewQty, { color: colors.textMuted }]}>
                      {formatQty(item.unitsSold)} × {formatCurrency(item.unitPrice)}
                    </Text>
                  </View>
                )}
              />
            )}

            <View style={styles.modalBtns}>
              <Button
                title="Close"
                variant="secondary"
                onPress={() => setSoldModalOpen(false)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </AnimatedModalBackdrop>
      </Modal>

        {/* DatePickerModal for fast date selection */}
        <DatePickerModal
          visible={datePickerOpen}
          onClose={() => setDatePickerOpen(false)}
          value={dateStr}
          maxDate={toDateString(new Date())}
          title="Select Stock Sheet Date"
          onSelectDate={handlePickDate}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dateBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  dateNavBtn: {
    padding: 7,
    borderRadius: 10,
  },
  dateCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateText: {
    fontSize: 15,
    fontWeight: "700",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
  },
  searchBox: {
    flex: 1,
    minWidth: 70,
  },
  searchInputWrapper: {
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  syncStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  syncStatusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  totalSalesPill: {
    paddingHorizontal: 8,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  totalSalesText: {
    fontSize: 12,
    fontWeight: "700",
  },
  iconActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  recordBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    height: 40,
    borderRadius: 10,
    gap: 4,
  },
  reconcileBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    height: 40,
    borderRadius: 10,
    gap: 4,
  },
  refreshToolbarBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  recordBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  allRecordedPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  allRecordedText: {
    fontSize: 11,
    fontWeight: "700",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  infoBannerText: {
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
  },
  recordedSubtext: {
    fontSize: 9,
    fontWeight: "600",
    marginTop: 1,
  },
  listContent: {
    padding: 10,
    paddingBottom: 24,
    gap: 8,
  },
  rowCard: {
    padding: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 6,
  },
  cardHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginRight: 4,
  },
  itemName: {
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  itemPrice: {
    fontSize: 11,
    fontWeight: "600",
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 4,
  },
  metricCol: {
    alignItems: "center",
    minWidth: 36,
  },
  metricValWrap: {
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  closingInputCol: {
    alignItems: "center",
    width: 62,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: "600",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  metricLabelTotal: {
    fontWeight: "800",
  },
  metricVal: {
    fontSize: 13,
  },
  metricValBold: {
    fontSize: 13,
    fontWeight: "700",
  },
  metricValSold: {
    fontSize: 12,
    fontWeight: "700",
  },
  closingInput: {
    width: "100%",
    height: 30,
    borderRadius: 8,
    borderWidth: 1.5,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 14,
    padding: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  centerLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyBox: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  modalRefreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalRefreshBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  modalDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  previewLine: {
    paddingVertical: 8,
    paddingRight: 14,
    borderBottomWidth: 0.5,
  },
  previewName: {
    fontSize: 13,
    fontWeight: "600",
  },
  previewQty: {
    fontSize: 12,
    marginTop: 2,
  },
  modalBtns: {
    flexDirection: "row",
    marginTop: 16,
    paddingBottom: 8,
  },
});
