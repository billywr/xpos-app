import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Barcode,
  ClipboardCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useOrg } from "@/context/OrgContext";
import {
  fetchStdStockCountSheet,
  saveStdStockCount,
  fetchStdStockCountSalesPreview,
  recordStdStockCountSales,
  fetchStdStockCountReconcilePreview,
  reconcileStdStockCountInventory,
} from "@/api/stdStockCount";
import type { StdStockCountRowResponse } from "@/types";
import { formatCurrency, formatQty } from "@/utils/formatCurrency";
import { haptics } from "@/utils/haptics";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const StockCountScreen: React.FC = () => {
  const { colors } = useTheme();
  const { token } = useAuth();
  const { orgId, branchId, terminalId } = useOrg();
  const queryClient = useQueryClient();

  const [date, setDate] = useState<Date>(new Date());
  const dateStr = useMemo(() => toDateString(date), [date]);
  const isToday = useMemo(() => dateStr === toDateString(new Date()), [dateStr]);

  const [searchQuery, setSearchQuery] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  // Local draft of edited closing stocks
  const [closingDrafts, setClosingDrafts] = useState<Record<string, string>>({});
  const [savingItemIds, setSavingItemIds] = useState<Set<string>>(new Set());

  // Record Sales & Reconcile Modals
  const [recordSalesOpen, setRecordSalesOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);

  // Auto-save debounce timer
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const AUTO_SAVE_DEBOUNCE_MS = 2500;
  const BLUR_SAVE_DEBOUNCE_MS = 150;

  // Fetch sheet query
  const {
    data: sheetData,
    isLoading: sheetLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["std-stock-count-sheet", token, orgId, branchId, dateStr],
    queryFn: () => fetchStdStockCountSheet(token, orgId!, branchId!, dateStr),
    enabled: Boolean(token && orgId && branchId),
  });

  // Sales preview query
  const { data: salesPreview, refetch: refetchSalesPreview } = useQuery({
    queryKey: ["std-stock-count-sales-preview", token, orgId, branchId, dateStr],
    queryFn: () =>
      fetchStdStockCountSalesPreview(token, orgId!, branchId!, dateStr),
    enabled: Boolean(token && orgId && branchId),
  });

  // Reconcile preview query
  const { data: reconcilePreview, refetch: refetchReconcilePreview } = useQuery({
    queryKey: ["std-stock-count-reconcile-preview", token, orgId, branchId, dateStr],
    queryFn: () =>
      fetchStdStockCountReconcilePreview(token, orgId!, branchId!, dateStr),
    enabled: Boolean(token && orgId && branchId && isToday),
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (counts: { itemId: string; closingStock: number }[]) =>
      saveStdStockCount(token, orgId!, branchId!, {
        date: dateStr,
        outletId: branchId!,
        counts,
      }),
    onSuccess: (updatedSheet) => {
      haptics.success();
      queryClient.setQueryData(
        ["std-stock-count-sheet", token, orgId, branchId, dateStr],
        updatedSheet
      );
      setSavingItemIds(new Set());
      void refetchSalesPreview();
      void refetchReconcilePreview();
    },
    onError: (err: any) => {
      haptics.error();
      setSavingItemIds(new Set());
      Alert.alert("Save Failed", err?.data?.message ?? "Could not save closing stock.");
    },
  });

  // Record Sales mutation
  const recordSalesMutation = useMutation({
    mutationFn: () =>
      recordStdStockCountSales(token, orgId!, branchId!, {
        date: dateStr,
        terminalId: terminalId ?? "term-1",
      }),
    onSuccess: () => {
      haptics.success();
      setRecordSalesOpen(false);
      Alert.alert("Success", "Sales have been recorded successfully.");
      void refetch();
      void refetchSalesPreview();
      void refetchReconcilePreview();
    },
    onError: (err: any) => {
      haptics.error();
      Alert.alert("Error", err?.data?.message ?? "Failed to record sales.");
    },
  });

  // Reconcile mutation
  const reconcileMutation = useMutation({
    mutationFn: () =>
      reconcileStdStockCountInventory(token, orgId!, branchId!, {
        date: dateStr,
        outletId: branchId!,
      }),
    onSuccess: () => {
      haptics.success();
      setReconcileOpen(false);
      Alert.alert("Success", "Inventory reconciled successfully.");
      void refetch();
      void refetchReconcilePreview();
    },
    onError: (err: any) => {
      haptics.error();
      Alert.alert("Error", err?.data?.message ?? "Failed to reconcile inventory.");
    },
  });

  // Save execution
  const executeSave = useCallback(
    (itemId?: string) => {
      const rows = sheetData?.rows ?? [];
      const countsToSave: { itemId: string; closingStock: number }[] = [];
      const itemIdsToMark = new Set<string>();

      if (itemId && closingDrafts[itemId] !== undefined) {
        const val = Number(closingDrafts[itemId]);
        if (!Number.isNaN(val) && val >= 0) {
          countsToSave.push({ itemId, closingStock: val });
          itemIdsToMark.add(itemId);
        }
      } else {
        Object.entries(closingDrafts).forEach(([id, strVal]) => {
          const val = Number(strVal);
          if (!Number.isNaN(val) && val >= 0) {
            countsToSave.push({ itemId: id, closingStock: val });
            itemIdsToMark.add(id);
          }
        });
      }

      if (countsToSave.length > 0) {
        setSavingItemIds(itemIdsToMark);
        saveMutation.mutate(countsToSave);
      }
    },
    [sheetData?.rows, closingDrafts, saveMutation]
  );

  // Handle typing closing stock
  const handleClosingChange = (itemId: string, val: string) => {
    setClosingDrafts((prev) => ({ ...prev, [itemId]: val }));

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

  // Date Navigation
  const changeDate = (days: number) => {
    haptics.light();
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    setDate(next);
    setClosingDrafts({});
  };

  // Filtered rows
  const filteredRows = useMemo(() => {
    const rows = sheetData?.rows ?? [];
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.sku && r.sku.toLowerCase().includes(q))
    );
  }, [sheetData?.rows, searchQuery]);

  // Totals calculations
  const totals = useMemo(() => {
    let totalItems = 0;
    let totalSold = 0;
    let totalRevenue = 0;

    (sheetData?.rows ?? []).forEach((r) => {
      totalItems += 1;
      const totalStock = r.openingStock + r.addedStock + r.addedTodayStock;
      const closing =
        closingDrafts[r.itemId] !== undefined
          ? Number(closingDrafts[r.itemId])
          : r.closingStock;
      if (closing !== null && !Number.isNaN(closing)) {
        const sold = Math.max(0, totalStock - closing);
        totalSold += sold;
        totalRevenue += sold * r.sellingPrice;
      }
    });

    return { totalItems, totalSold, totalRevenue };
  }, [sheetData?.rows, closingDrafts]);

  // Action button visibility
  const totalQtyToRecord = salesPreview?.totalQtyToRecord ?? 0;
  const itemsToReconcile = reconcilePreview?.itemsAdjusted ?? 0;
  const showRecordSales = totalQtyToRecord > 0;
  const showReconcile = isToday && itemsToReconcile > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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

        <View style={styles.dateCenter}>
          <Calendar size={16} color={colors.primary} />
          <Text style={[styles.dateText, { color: colors.text }]}>
            {dateStr} {isToday ? "(Today)" : ""}
          </Text>
        </View>

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

      {/* Summary KPI Strip */}
      <View
        style={[
          styles.kpiStrip,
          { backgroundColor: colors.surfaceCard, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.kpiCol}>
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Items</Text>
          <Text style={[styles.kpiValue, { color: colors.text }]}>
            {totals.totalItems}
          </Text>
        </View>
        <View style={[styles.kpiDivider, { backgroundColor: colors.border }]} />
        <View style={styles.kpiCol}>
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Sold Units</Text>
          <Text style={[styles.kpiValue, { color: colors.primary }]}>
            {formatQty(totals.totalSold)}
          </Text>
        </View>
        <View style={[styles.kpiDivider, { backgroundColor: colors.border }]} />
        <View style={styles.kpiCol}>
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Revenue</Text>
          <Text style={[styles.kpiValue, { color: colors.accent }]}>
            {formatCurrency(totals.totalRevenue)}
          </Text>
        </View>
      </View>

      {/* Search & Action Bar */}
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Input
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search items or SKU…"
            leftIcon={<Search size={16} color={colors.textSubtle} />}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>
        <TouchableOpacity
          onPress={() => setScannerOpen(true)}
          style={[styles.iconActionBtn, { backgroundColor: colors.surfaceRaised }]}
        >
          <Barcode size={20} color={colors.primary} />
        </TouchableOpacity>

        {showRecordSales ? (
          <TouchableOpacity
            onPress={() => setRecordSalesOpen(true)}
            style={[styles.recordBtn, { backgroundColor: colors.primary }]}
          >
            <ClipboardCheck size={18} color="#ffffff" />
            <Text style={styles.recordBtnText}>{totalQtyToRecord}</Text>
          </TouchableOpacity>
        ) : null}

        {showReconcile ? (
          <TouchableOpacity
            onPress={() => setReconcileOpen(true)}
            style={[styles.reconcileBtn, { backgroundColor: colors.warning }]}
          >
            <RefreshCw size={18} color="#ffffff" />
            <Text style={styles.recordBtnText}>{itemsToReconcile}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Sheet Items List */}
      {sheetLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading stock count sheet…
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRows}
          keyExtractor={(item) => item.itemId}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {searchQuery ? "No items match your search." : "No stock sheet rows."}
              </Text>
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

            const closingNum = Number(currentClosing);
            const unitsSold =
              !Number.isNaN(closingNum) && currentClosing !== ""
                ? Math.max(0, totalStock - closingNum)
                : 0;
            const soldAmount = unitsSold * item.sellingPrice;

            return (
              <Card style={styles.rowCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemName, { color: colors.text }]}>
                      {index + 1}. {item.name}
                    </Text>
                    <Text style={[styles.itemSku, { color: colors.textSubtle }]}>
                      SKU: {item.sku || "N/A"} · Price: {formatCurrency(item.sellingPrice)}
                    </Text>
                  </View>
                  {isSaving ? (
                    <Badge label="Saving…" variant="warning" size="sm" />
                  ) : isUnsaved ? (
                    <Badge label="Unsaved" variant="danger" size="sm" />
                  ) : item.lastSavedAt ? (
                    <Badge label="Saved" variant="primary" size="sm" />
                  ) : null}
                </View>

                {/* Stock figures grid */}
                <View style={styles.metricsRow}>
                  <View style={styles.metricCol}>
                    <Text style={[styles.metricLabel, { color: colors.textSubtle }]}>
                      Open
                    </Text>
                    <Text style={[styles.metricVal, { color: colors.textMuted }]}>
                      {formatQty(item.openingStock)}
                    </Text>
                  </View>
                  <View style={styles.metricCol}>
                    <Text style={[styles.metricLabel, { color: colors.textSubtle }]}>
                      Added
                    </Text>
                    <Text style={[styles.metricVal, { color: colors.textMuted }]}>
                      {formatQty(item.addedStock + item.addedTodayStock)}
                    </Text>
                  </View>
                  <View style={styles.metricCol}>
                    <Text style={[styles.metricLabel, { color: colors.textSubtle }]}>
                      Total
                    </Text>
                    <Text style={[styles.metricValBold, { color: colors.text }]}>
                      {formatQty(totalStock)}
                    </Text>
                  </View>

                  {/* Closing Stock Input */}
                  <View style={styles.closingInputCol}>
                    <Text style={[styles.metricLabel, { color: colors.primary }]}>
                      Close
                    </Text>
                    <TextInput
                      value={currentClosing}
                      onChangeText={(val) => handleClosingChange(item.itemId, val)}
                      onBlur={() => handleClosingBlur(item.itemId)}
                      keyboardType="numeric"
                      selectTextOnFocus
                      placeholder="0"
                      placeholderTextColor={colors.textSubtle}
                      style={[
                        styles.closingInput,
                        {
                          backgroundColor: colors.surfaceRaised,
                          color: colors.text,
                          borderColor: isUnsaved ? colors.warning : colors.border,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.metricCol}>
                    <Text style={[styles.metricLabel, { color: colors.primary }]}>
                      Sold
                    </Text>
                    <Text style={[styles.metricValSold, { color: colors.primary }]}>
                      {formatQty(unitsSold)}
                    </Text>
                  </View>
                  <View style={styles.metricCol}>
                    <Text style={[styles.metricLabel, { color: colors.accent }]}>
                      Amt
                    </Text>
                    <Text style={[styles.metricValSold, { color: colors.accent }]}>
                      {formatCurrency(soldAmount)}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* Record Sales Preview Modal */}
      <Modal visible={recordSalesOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Record Sales Preview
            </Text>
            <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
              Create POS sales for {totalQtyToRecord} units sold (Total:{" "}
              {formatCurrency(salesPreview?.totalValueToRecord ?? 0)}).
            </Text>

            <FlatList
              data={salesPreview?.lines.filter((l) => l.qtyToRecord > 0) ?? []}
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
                  <Text style={[styles.previewQty, { color: colors.primary }]}>
                    {item.qtyToRecord} × {formatCurrency(item.unitPrice)} ={" "}
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
          </View>
        </View>
      </Modal>

      {/* Reconcile Inventory Modal */}
      <Modal visible={reconcileOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Reconcile Inventory
            </Text>
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
                    Close: {item.closingStock} · On-Hand: {item.onHandQty} · Var:{" "}
                    {item.variance > 0 ? `+${item.variance}` : item.variance}
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
        </View>
      </Modal>

      {/* Barcode Camera Scanner */}
      <BarcodeScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(barcode) => {
          setSearchQuery(barcode);
        }}
      />
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
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  dateNavBtn: {
    padding: 8,
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
  kpiStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  kpiCol: {
    alignItems: "center",
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2,
  },
  kpiDivider: {
    width: 1,
    height: 24,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  searchBox: {
    flex: 1,
  },
  iconActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  recordBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    gap: 6,
  },
  reconcileBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    gap: 6,
  },
  recordBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  rowCard: {
    padding: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "700",
  },
  itemSku: {
    fontSize: 11,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  metricCol: {
    alignItems: "center",
  },
  closingInputCol: {
    alignItems: "center",
    width: 68,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  metricVal: {
    fontSize: 13,
  },
  metricValBold: {
    fontSize: 14,
    fontWeight: "700",
  },
  metricValSold: {
    fontSize: 13,
    fontWeight: "700",
  },
  closingInput: {
    width: "100%",
    height: 36,
    borderRadius: 8,
    borderWidth: 1.5,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 14,
    padding: 0,
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
    paddingBottom: 16,
  },
});
