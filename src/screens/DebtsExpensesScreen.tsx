import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useProgressiveList } from "@/hooks/useProgressiveList";
import { useToast } from "@/context/ToastContext";
import {
  HandCoins,
  Receipt,
  Plus,
  Search,
  CheckCircle2,
  Calendar,
  Phone,
  User,
  RefreshCw,
  Building2,
  Power,
  Pencil,
  Trash2,
  X,
} from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useOrg } from "@/context/OrgContext";
import {
  fetchDebts,
  fetchDebtPendingTotal,
  createDebt,
  settleDebt,
} from "@/api/debts";
import {
  fetchMiscExpenses,
  createMiscExpense,
  fetchExpenseCategories,
} from "@/api/miscExpenses";
import {
  fetchRecurringUtilities,
  fetchRecurringUtilitySummary,
  createRecurringUtility,
  updateRecurringUtility,
  deleteRecurringUtility,
} from "@/api/recurringUtilities";
import type {
  CustomerDebtResponse,
  MiscExpenseResponse,
  RecurringUtilityResponse,
  RecurringUtilityApplyTiming,
  RecurringUtilityCreateRequest,
  RecurringUtilityUpdateRequest,
} from "@/types";
import { debtsExpensesRepository } from "@/repositories/debtsExpensesRepository";
import { recurringUtilitiesRepository } from "@/repositories/recurringUtilitiesRepository";
import { outboxEngine } from "@/services/outboxEngine";
import { UtilityPresetSelector } from "@/components/UtilityPresetSelector";
import { useSyncStatus } from "@/services/useSyncStatus";
import { formatCurrency, formatAmountWithCommas } from "@/utils/formatCurrency";
import { haptics } from "@/utils/haptics";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { DatePickerModal } from "@/components/ui/DatePickerModal";
import { AnimatedModalBackdrop } from "@/components/ui/AnimatedModalBackdrop";
import { SyncStatusDot } from "@/components/SyncStatusDot";

const PAGE_SIZE = 30;

type DatePreset = "all" | "today" | "7days" | "30days" | "custom";

function formatDateIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getDebtExpenseRange(preset: DatePreset): { start?: string; end?: string } {
  const now = new Date();
  const today = formatDateIso(now);
  if (preset === "today") {
    return { start: today, end: today };
  }
  if (preset === "7days") {
    const s = new Date(now);
    s.setDate(s.getDate() - 7);
    return { start: formatDateIso(s), end: today };
  }
  if (preset === "30days") {
    const s = new Date(now);
    s.setDate(s.getDate() - 30);
    return { start: formatDateIso(s), end: today };
  }
  return {};
}

// ---------------------------------------------------------------------------
// Skeleton card — Debt item (Balanced 5-column single row)
// ---------------------------------------------------------------------------
const DebtSkeletonCard: React.FC = () => (
  <Card style={{ paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
      <View style={{ width: 75, gap: 4 }}>
        <SkeletonBlock width={55} height={13} radius={5} />
        <SkeletonBlock width={40} height={9} radius={3} />
      </View>
      <View style={{ flex: 1, alignItems: "center", gap: 3 }}>
        <SkeletonBlock width={22} height={8} radius={2} />
        <SkeletonBlock width={44} height={12} radius={4} />
      </View>
      <View style={{ flex: 1, alignItems: "center", gap: 3 }}>
        <SkeletonBlock width={22} height={8} radius={2} />
        <SkeletonBlock width={44} height={12} radius={4} />
      </View>
      <View style={{ width: 50, alignItems: "center" }}>
        <SkeletonBlock width={42} height={22} radius={6} />
      </View>
      <View style={{ width: 65, alignItems: "center" }}>
        <SkeletonBlock width={54} height={18} radius={9} />
      </View>
    </View>
  </Card>
);

// ---------------------------------------------------------------------------
// Skeleton card — Expense item (Compact single row)
// ---------------------------------------------------------------------------
const ExpenseSkeletonCard: React.FC = () => (
  <Card style={{ paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <SkeletonBlock width={64} height={18} radius={9} />
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 4 }}>
        <SkeletonBlock width="60%" height={13} radius={5} />
        <SkeletonBlock width="25%" height={11} radius={4} />
      </View>
      <SkeletonBlock width={60} height={14} radius={5} />
    </View>
  </Card>
);

// ---------------------------------------------------------------------------
// Skeleton card — Recurring Utility item (Compact single row)
// ---------------------------------------------------------------------------
const UtilitySkeletonCard: React.FC = () => (
  <Card style={{ paddingVertical: 10, paddingHorizontal: 12, marginBottom: 6 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ flex: 1, gap: 5 }}>
        <SkeletonBlock width={120} height={14} radius={4} />
        <View style={{ flexDirection: "row", gap: 6 }}>
          <SkeletonBlock width={48} height={12} radius={4} />
          <SkeletonBlock width={70} height={12} radius={4} />
        </View>
      </View>
      <View style={{ alignItems: "flex-end", gap: 5 }}>
        <SkeletonBlock width={65} height={15} radius={4} />
        <SkeletonBlock width={60} height={18} radius={6} />
      </View>
    </View>
  </Card>
);


export const DebtsExpensesScreen: React.FC = () => {
  const { colors } = useTheme();
  const { token } = useAuth();
  const { orgId, branchId } = useOrg();
  const { isOnline } = useSyncStatus();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"debts" | "expenses" | "utilities">("debts");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("OUTSTANDING");

  // Utilities State
  const [utilityStatusFilter, setUtilityStatusFilter] = useState<"ACTIVE" | "ALL" | "INACTIVE">("ACTIVE");
  const [recordUtilOpen, setRecordUtilOpen] = useState(false);
  const [editingUtility, setEditingUtility] = useState<RecurringUtilityResponse | null>(null);
  const [deleteUtilityItem, setDeleteUtilityItem] = useState<RecurringUtilityResponse | null>(null);

  // Form fields for utility
  const [utilName, setUtilName] = useState("");
  const [utilAmount, setUtilAmount] = useState("");
  const [utilTiming, setUtilTiming] = useState<RecurringUtilityApplyTiming>("BEGINNING_OF_MONTH");
  const [utilNotes, setUtilNotes] = useState("");
  const [utilActive, setUtilActive] = useState(true);

  // Date Filtering State
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customStartDate, setCustomStartDate] = useState(() => {
    const s = new Date();
    s.setDate(s.getDate() - 30);
    return formatDateIso(s);
  });
  const [customEndDate, setCustomEndDate] = useState(() => formatDateIso(new Date()));
  const [pickerTarget, setPickerTarget] = useState<"start" | "end" | null>(null);

  const { effectiveStartDate, effectiveEndDate } = useMemo(() => {
    if (datePreset === "custom") {
      return { effectiveStartDate: customStartDate, effectiveEndDate: customEndDate };
    }
    if (datePreset === "all") {
      return { effectiveStartDate: undefined, effectiveEndDate: undefined };
    }
    const r = getDebtExpenseRange(datePreset);
    return { effectiveStartDate: r.start, effectiveEndDate: r.end };
  }, [datePreset, customStartDate, customEndDate]);

  // Record Debt Modal
  const [recordDebtOpen, setRecordDebtOpen] = useState(false);
  const [debtCustomerName, setDebtCustomerName] = useState("");
  const [debtCustomerPhone, setDebtCustomerPhone] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtDueDate, setDebtDueDate] = useState("");
  const [debtNotes, setDebtNotes] = useState("");

  // Settle Debt Modal
  const [settleDebtItem, setSettleDebtItem] = useState<CustomerDebtResponse | null>(
    null
  );
  const [settleAmount, setSettleAmount] = useState("");

  // Record Expense Modal
  const [recordExpOpen, setRecordExpOpen] = useState(false);
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState("Supplies");
  const [expDescription, setExpDescription] = useState("");
  const [expIncurredBy, setExpIncurredBy] = useState("");
  const [expReceiptRef, setExpReceiptRef] = useState("");

  // Queries: Debts
  const statusParam =
    statusFilter === "OUTSTANDING"
      ? ["OPEN", "PARTIAL"]
      : statusFilter === "ALL"
      ? ["OPEN", "PARTIAL", "CLOSED"]
      : statusFilter;

  // Instant local SQLite debts query (<5ms)
  const {
    data: localDebts,
    isLoading: debtsLoading,
    isRefetching: debtsRefetching,
    refetch: refetchDebts,
  } = useQuery({
    queryKey: ["local-debts-list", orgId, branchId, statusFilter],
    queryFn: () => debtsExpensesRepository.getDebts(orgId!, branchId!, statusFilter),
    enabled: Boolean(orgId && branchId && activeTab === "debts"),
  });
  const debts = localDebts ?? [];

  // Instant local SQLite expenses query (<5ms)
  const {
    data: localExpenses,
    isLoading: expensesLoading,
    isRefetching: expRefetching,
    refetch: refetchExpenses,
  } = useQuery({
    queryKey: ["local-expenses-list", orgId, branchId, effectiveStartDate, effectiveEndDate],
    queryFn: () => debtsExpensesRepository.getExpenses(orgId!, branchId!, effectiveStartDate, effectiveEndDate),
    enabled: Boolean(orgId && branchId && activeTab === "expenses"),
  });
  const expenses = localExpenses ?? [];

  // Instant local SQLite utilities query (<5ms)
  const activeFilterArg =
    utilityStatusFilter === "ACTIVE" ? true : utilityStatusFilter === "INACTIVE" ? false : "ALL";

  const {
    data: localUtilities,
    isLoading: utilsLoading,
    isRefetching: utilsRefetching,
    refetch: refetchUtilities,
  } = useQuery({
    queryKey: ["local-recurring-utilities", orgId, branchId, activeFilterArg],
    queryFn: () => recurringUtilitiesRepository.getUtilities(orgId!, branchId!, activeFilterArg),
    enabled: Boolean(orgId && branchId && activeTab === "utilities"),
  });
  const utilities = localUtilities ?? [];

  const {
    data: utilitiesSummary,
    refetch: refetchUtilitySummary,
  } = useQuery({
    queryKey: ["local-recurring-utilities-summary", orgId, branchId],
    queryFn: () => recurringUtilitiesRepository.getUtilitySummary(orgId!, branchId!),
    enabled: Boolean(orgId && branchId && activeTab === "utilities"),
  });

  const debtsHasNext = false;
  const debtsFetchingNext = false;
  const debtsFetchNext = async () => {};

  const expHasNext = false;
  const expFetchingNext = false;
  const expFetchNext = async () => {};

  // Background hydration for debts, expenses, and utilities
  React.useEffect(() => {
    if (!token || !orgId || !branchId || !isOnline) return;
    if (activeTab === "debts") {
      fetchDebts(token, orgId, branchId, { page: 0, size: 200, sort: "createdAt,desc" })
        .then(async (res) => {
          if (!res?.content) return;
          await debtsExpensesRepository.hydrateDebtsFromRemote(orgId, branchId, res.content);
          void queryClient.invalidateQueries({ queryKey: ["local-debts-list", orgId, branchId] });
        })
        .catch(() => {});
    } else if (activeTab === "expenses") {
      fetchMiscExpenses(token, orgId, branchId, { page: 0, size: 200, sort: "createdAt,desc" })
        .then(async (res) => {
          if (!res?.content) return;
          await debtsExpensesRepository.hydrateExpensesFromRemote(orgId, branchId, res.content);
          void queryClient.invalidateQueries({ queryKey: ["local-expenses-list", orgId, branchId] });
        })
        .catch(() => {});
    } else {
      fetchRecurringUtilities(token, orgId, branchId, { size: 200 })
        .then(async (res) => {
          if (!res?.items) return;
          await recurringUtilitiesRepository.hydrateFromRemote(orgId, branchId, res.items);
          void queryClient.invalidateQueries({ queryKey: ["local-recurring-utilities", orgId, branchId] });
          void queryClient.invalidateQueries({ queryKey: ["local-recurring-utilities-summary", orgId, branchId] });
        })
        .catch(() => {});
    }
  }, [token, orgId, branchId, activeTab, isOnline, queryClient]);

  // Queries: Expense Categories
  const { data: expenseCategories = ["Supplies", "Utilities", "Wages", "Transport", "Other"] } =
    useQuery({
      queryKey: ["expense-categories", token, orgId, branchId],
      queryFn: () => fetchExpenseCategories(token, orgId!, branchId!),
      enabled: Boolean(token && orgId && branchId && isOnline),
    });

  // Create Debt Mutation (local-first with outbox sync)
  const createDebtMutation = useMutation({
    mutationFn: () =>
      debtsExpensesRepository.createDebt(orgId!, branchId!, {
        customerId: `temp-${Date.now()}`,
        customerName: debtCustomerName.trim(),
        customerPhone: debtCustomerPhone.trim() || undefined,
        amount: Number(debtAmount.replace(/,/g, "")),
        dueDate: debtDueDate ? debtDueDate : undefined,
        notes: debtNotes ? debtNotes : undefined,
      }),
    onSuccess: () => {
      haptics.success();
      setRecordDebtOpen(false);
      setDebtCustomerName("");
      setDebtCustomerPhone("");
      setDebtAmount("");
      setDebtDueDate("");
      setDebtNotes("");
      void outboxEngine.processQueue();
      void refetchDebts();
      void queryClient.invalidateQueries({ queryKey: ["debts-pending-total"] });
      toast.success("Debt recorded (queued for sync).");
    },
    onError: (err: any) => {
      haptics.error();
      toast.error(err?.data?.message ?? err?.message ?? "Failed to record debt.", "Error");
    },
  });

  // Settle Debt Mutation (local-first with outbox sync)
  const settleDebtMutation = useMutation({
    mutationFn: () =>
      debtsExpensesRepository.settleDebt(orgId!, branchId!, settleDebtItem!.id, Number(settleAmount.replace(/,/g, ""))),
    onSuccess: () => {
      haptics.success();
      setSettleDebtItem(null);
      setSettleAmount("");
      void outboxEngine.processQueue();
      void refetchDebts();
      void queryClient.invalidateQueries({ queryKey: ["debts-pending-total"] });
      toast.success("Payment recorded (queued for sync).");
    },
    onError: (err: any) => {
      haptics.error();
      toast.error(err?.data?.message ?? err?.message ?? "Failed to settle payment.", "Error");
    },
  });

  // Create Expense Mutation (local-first with outbox sync)
  const createExpMutation = useMutation({
    mutationFn: () =>
      debtsExpensesRepository.createExpense(orgId!, branchId!, {
        amount: Number(expAmount.replace(/,/g, "")),
        category: expCategory,
        description: expDescription.trim(),
        incurredBy: expIncurredBy.trim() || undefined,
        receiptRef: expReceiptRef.trim() || undefined,
      }),
    onSuccess: () => {
      haptics.success();
      setRecordExpOpen(false);
      setExpAmount("");
      setExpDescription("");
      setExpIncurredBy("");
      setExpReceiptRef("");
      void outboxEngine.processQueue();
      void refetchExpenses();
      toast.success("Expense recorded (queued for sync).");
    },
    onError: (err: any) => {
      haptics.error();
      toast.error(err?.data?.message ?? err?.message ?? "Failed to record expense.", "Error");
    },
  });

  // Create Utility Mutation (local-first with outbox sync)
  const createUtilityMutation = useMutation({
    mutationFn: () =>
      recurringUtilitiesRepository.createUtility(orgId!, branchId!, {
        name: utilName.trim(),
        amount: Number(utilAmount.replace(/,/g, "")),
        applyTiming: utilTiming,
        notes: utilNotes.trim() || undefined,
      }),
    onSuccess: () => {
      haptics.success();
      setRecordUtilOpen(false);
      setUtilName("");
      setUtilAmount("");
      setUtilTiming("BEGINNING_OF_MONTH");
      setUtilNotes("");
      setUtilActive(true);
      void outboxEngine.processQueue();
      void refetchUtilities();
      void refetchUtilitySummary();
      void queryClient.invalidateQueries({ queryKey: ["mobile-revenue-dashboard"] });
      toast.success("Utility overhead recorded (queued for sync).");
    },
    onError: (err: any) => {
      haptics.error();
      toast.error(err?.data?.message ?? err?.message ?? "Failed to record utility.", "Error");
    },
  });

  // Update Utility Mutation (local-first with outbox sync)
  const updateUtilityMutation = useMutation({
    mutationFn: ({ id, req }: { id: string; req: RecurringUtilityUpdateRequest }) =>
      recurringUtilitiesRepository.updateUtility(orgId!, branchId!, id, req),
    onSuccess: () => {
      haptics.success();
      setRecordUtilOpen(false);
      setEditingUtility(null);
      void outboxEngine.processQueue();
      void refetchUtilities();
      void refetchUtilitySummary();
      void queryClient.invalidateQueries({ queryKey: ["mobile-revenue-dashboard"] });
      toast.success("Utility overhead updated.");
    },
    onError: (err: any) => {
      haptics.error();
      toast.error(err?.data?.message ?? err?.message ?? "Failed to update utility.", "Error");
    },
  });

  // Delete Utility Mutation (local-first with outbox sync)
  const deleteUtilityMutation = useMutation({
    mutationFn: (utilityId: string) =>
      recurringUtilitiesRepository.deleteUtility(orgId!, branchId!, utilityId),
    onSuccess: () => {
      haptics.success();
      setDeleteUtilityItem(null);
      void outboxEngine.processQueue();
      void refetchUtilities();
      void refetchUtilitySummary();
      void queryClient.invalidateQueries({ queryKey: ["mobile-revenue-dashboard"] });
      toast.success("Utility overhead deleted.");
    },
    onError: (err: any) => {
      haptics.error();
      toast.error(err?.data?.message ?? err?.message ?? "Failed to delete utility.", "Error");
    },
  });

  // Debts Pending Total query
  const { data: debtPendingTotalData, refetch: refetchPendingTotal } = useQuery({
    queryKey: ["debts-pending-total", token, orgId, branchId],
    queryFn: () => fetchDebtPendingTotal(token, orgId!, branchId!),
    enabled: Boolean(token && orgId && branchId && activeTab === "debts" && isOnline),
  });

  // Filtered Debts
  const filteredDebts = useMemo(() => {
    if (!searchQuery.trim()) return debts;
    const q = searchQuery.toLowerCase().trim();
    return debts.filter(
      (d) =>
        d.customerName.toLowerCase().includes(q) ||
        (d.customerPhone && d.customerPhone.includes(q))
    );
  }, [debts, searchQuery]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    if (!searchQuery.trim()) return expenses;
    const q = searchQuery.toLowerCase().trim();
    return expenses.filter(
      (e) =>
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.incurredBy && e.incurredBy.toLowerCase().includes(q))
    );
  }, [expenses, searchQuery]);

  // Filtered Utilities
  const filteredUtilities = useMemo(() => {
    if (!searchQuery.trim()) return utilities;
    const q = searchQuery.toLowerCase().trim();
    return utilities.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.notes && u.notes.toLowerCase().includes(q))
    );
  }, [utilities, searchQuery]);

  // Progressive chunk-by-chunk windowing for high-performance 60fps rendering
  const { visibleItems: progressiveDebts, loadMore: loadMoreDebts } = useProgressiveList(
    filteredDebts,
    { chunkSize: 20 }
  );

  const { visibleItems: progressiveExpenses, loadMore: loadMoreExpenses } = useProgressiveList(
    filteredExpenses,
    { chunkSize: 25 }
  );

  const { visibleItems: progressiveUtilities, loadMore: loadMoreUtilities } = useProgressiveList(
    filteredUtilities,
    { chunkSize: 25 }
  );

  // Dynamic Total Amount in Toolbar
  const currentTotal = useMemo(() => {
    if (activeTab === "debts") {
      if (searchQuery.trim() || datePreset !== "all") {
        return filteredDebts.reduce((sum, d) => sum + (d.outstanding || 0), 0);
      }
      return (
        debtPendingTotalData?.totalPending ??
        debts.reduce((sum, d) => sum + (d.outstanding || 0), 0)
      );
    } else if (activeTab === "expenses") {
      if (searchQuery.trim() || datePreset !== "all") {
        return filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      }
      return expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    } else {
      if (searchQuery.trim() || utilityStatusFilter !== "ALL") {
        return filteredUtilities.reduce((sum, u) => sum + (u.active ? u.amount : 0), 0);
      }
      return (
        utilitiesSummary?.monthlyTotalAmount ??
        utilities.reduce((sum, u) => sum + (u.active ? u.amount : 0), 0)
      );
    }
  }, [
    activeTab,
    searchQuery,
    datePreset,
    utilityStatusFilter,
    filteredDebts,
    debtPendingTotalData,
    debts,
    filteredExpenses,
    expenses,
    filteredUtilities,
    utilitiesSummary,
    utilities,
  ]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Segmented Tab Control */}
      <View style={[styles.topBar, { backgroundColor: colors.surface }]}>
        <SegmentedControl
          options={[
            { id: "debts", label: "Customer Debts", icon: <HandCoins size={16} color={colors.text} /> },
            { id: "expenses", label: "Store Expenses", icon: <Receipt size={16} color={colors.text} /> },
            { id: "utilities", label: "Utilities", icon: <Building2 size={16} color={colors.text} /> },
          ]}
          activeId={activeTab}
          onChange={(tab) => {
            setActiveTab(tab as any);
            setSearchQuery("");
          }}
        />
      </View>

      {/* Toolbar: Search + Total Amount + Action Button (Single Level) */}
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Input
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={
              activeTab === "debts"
                ? "Search debts…"
                : activeTab === "expenses"
                ? "Search expenses…"
                : "Search utilities…"
            }
            leftIcon={<Search size={15} color={colors.textSubtle} />}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>

        <SyncStatusDot />

        <View
          style={[
            styles.totalBadge,
            {
              backgroundColor:
                activeTab === "debts"
                  ? colors.warningLight
                  : activeTab === "expenses"
                  ? colors.dangerLight
                  : colors.primaryLight,
              borderColor:
                activeTab === "debts"
                  ? colors.warning
                  : activeTab === "expenses"
                  ? colors.danger
                  : colors.primary,
            },
          ]}
        >
          <Text style={[styles.totalLabel, { color: colors.textSubtle }]}>
            {activeTab === "utilities" ? "ACTIVE/MO" : "TOTAL"}
          </Text>
          <Text
            style={[
              styles.totalVal,
              {
                color:
                  activeTab === "debts"
                    ? colors.warning
                    : activeTab === "expenses"
                    ? colors.danger
                    : colors.primary,
              },
            ]}
            numberOfLines={1}
          >
            {(activeTab === "debts"
              ? debtsLoading && !localDebts
              : activeTab === "expenses"
              ? expensesLoading && !localExpenses
              : utilsLoading && !localUtilities)
              ? "—"
              : formatCurrency(currentTotal)}
          </Text>
        </View>

        {activeTab === "debts" ? (
          <Button
            title="+ Debt"
            size="sm"
            onPress={() => {
              haptics.light();
              setRecordDebtOpen(true);
            }}
            style={styles.actionBtn}
          />
        ) : activeTab === "expenses" ? (
          <Button
            title="+ Expense"
            size="sm"
            onPress={() => {
              haptics.light();
              setRecordExpOpen(true);
            }}
            style={styles.actionBtn}
          />
        ) : (
          <Button
            title="+ Utility"
            size="sm"
            onPress={() => {
              haptics.light();
              setEditingUtility(null);
              setUtilName("");
              setUtilAmount("");
              setUtilTiming("BEGINNING_OF_MONTH");
              setUtilNotes("");
              setUtilActive(true);
              setRecordUtilOpen(true);
            }}
            style={styles.actionBtn}
          />
        )}

        <TouchableOpacity
          onPress={async () => {
            haptics.light();
            if (activeTab === "debts") {
              if (isOnline) {
                await Promise.all([refetchDebts(), refetchPendingTotal()]);
              } else {
                await refetchDebts();
              }
            } else if (activeTab === "expenses") {
              await Promise.all([refetchExpenses()]);
            } else {
              await Promise.all([refetchUtilities(), refetchUtilitySummary()]);
            }
          }}
          disabled={
            activeTab === "debts"
              ? debtsRefetching
              : activeTab === "expenses"
              ? expRefetching
              : utilsRefetching
          }
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Refresh list"
          style={[
            styles.refreshToolbarBtn,
            {
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.border,
            },
          ]}
        >
          {(activeTab === "debts"
            ? debtsRefetching
            : activeTab === "expenses"
            ? expRefetching
            : utilsRefetching) ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <RefreshCw size={15} color={colors.text} />
          )}
        </TouchableOpacity>
      </View>

      {/* Filter Chips: Status filter for Utilities; Date range chips for debts/expenses */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          {activeTab === "utilities" ? (
            (["ACTIVE", "ALL", "INACTIVE"] as const).map((filter) => {
              const isSelected = utilityStatusFilter === filter;
              return (
                <TouchableOpacity
                  key={filter}
                  onPress={() => {
                    haptics.light();
                    setUtilityStatusFilter(filter);
                  }}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isSelected
                        ? colors.primaryLight
                        : colors.surfaceRaised,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color: isSelected ? colors.primary : colors.textMuted,
                        fontWeight: isSelected ? "700" : "500",
                      },
                    ]}
                  >
                    {filter === "ACTIVE" ? "Active" : filter === "ALL" ? "All" : "Inactive"}
                  </Text>
                </TouchableOpacity>
              );
            })
          ) : (
            (
              [
                { key: "all", label: "All" },
                { key: "today", label: "Today" },
                { key: "7days", label: "Last 7 Days" },
                { key: "30days", label: "Last 30 Days" },
                { key: "custom", label: "Custom" },
              ] as const
            ).map((chip) => {
              const isSelected = datePreset === chip.key;
              return (
                <TouchableOpacity
                  key={chip.key}
                  onPress={() => {
                    haptics.light();
                    setDatePreset(chip.key);
                  }}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isSelected
                        ? colors.primaryLight
                        : colors.surfaceRaised,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color: isSelected ? colors.primary : colors.textMuted,
                        fontWeight: isSelected ? "700" : "500",
                      },
                    ]}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Custom Date Range Selector (When Custom preset selected) */}
      {datePreset === "custom" && (
        <View
          style={[
            styles.customRangeBar,
            { backgroundColor: colors.surface, borderColor: colors.borderSubtle },
          ]}
        >
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setPickerTarget("start");
            }}
            style={[
              styles.dateTriggerBtn,
              { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
            ]}
          >
            <Calendar size={13} color={colors.primary} />
            <Text style={[styles.dateTriggerLabel, { color: colors.textSubtle }]}>
              Start:
            </Text>
            <Text style={[styles.dateTriggerVal, { color: colors.text }]}>
              {customStartDate}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.rangeArrow, { color: colors.textSubtle }]}>→</Text>

          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setPickerTarget("end");
            }}
            style={[
              styles.dateTriggerBtn,
              { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
            ]}
          >
            <Calendar size={13} color={colors.primary} />
            <Text style={[styles.dateTriggerLabel, { color: colors.textSubtle }]}>
              End:
            </Text>
            <Text style={[styles.dateTriggerVal, { color: colors.text }]}>
              {customEndDate}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content Lists */}
      {activeTab === "debts" ? (
        debtsLoading && (!localDebts || debts.length === 0) ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.listContent, { paddingTop: 8 }]}
            scrollEnabled={false}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <DebtSkeletonCard key={i} />
            ))}
          </ScrollView>
        ) : (
          <FlatList
            data={progressiveDebts}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={debtsRefetching}
                onRefresh={refetchDebts}
                tintColor={colors.primary}
              />
            }
            contentContainerStyle={styles.listContent}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === "android"}
            onEndReachedThreshold={0.5}
            onEndReached={loadMoreDebts}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <HandCoins size={36} color={colors.textSubtle} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  {searchQuery ? "No debts match your search." : "No active customer debts."}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Card style={styles.cardItem}>
                <View style={styles.debtRow}>
                  {/* Col 1: Customer name & phone */}
                  <View style={styles.debtColCustomer}>
                    <Text style={[styles.debtCustomerName, { color: colors.text }]} numberOfLines={1}>
                      {item.customerName}
                    </Text>
                    {item.customerPhone ? (
                      <Text style={[styles.debtCustomerPhone, { color: colors.textSubtle }]} numberOfLines={1}>
                        {item.customerPhone}
                      </Text>
                    ) : null}
                  </View>

                  {/* Col 2: Bal Column */}
                  <View style={styles.debtColBal}>
                    <Text style={[styles.metricLabelSmall, { color: colors.textSubtle }]}>Bal</Text>
                    <Text style={[styles.metricBalVal, { color: colors.warning }]}>
                      {formatCurrency(item.outstanding)}
                    </Text>
                  </View>

                  {/* Col 3: Set Column */}
                  <View style={styles.debtColSet}>
                    <Text style={[styles.metricLabelSmall, { color: colors.textSubtle }]}>Set</Text>
                    <Text style={[styles.metricSetVal, { color: colors.textMuted }]}>
                      {formatCurrency(item.amountSettled)}
                    </Text>
                  </View>

                  {/* Col 4: Action (Pay) */}
                  <View style={styles.debtColAction}>
                    {item.outstanding > 0 ? (
                      <TouchableOpacity
                        onPress={() => {
                          haptics.light();
                          setSettleDebtItem(item);
                          setSettleAmount(formatAmountWithCommas(String(item.outstanding)));
                        }}
                        style={[styles.repayBtn, { backgroundColor: colors.primary }]}
                      >
                        <Text style={styles.repayBtnText}>Pay</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Col 5: Status Badge */}
                  <View style={styles.debtColStatus}>
                    <Badge
                      label={item.status}
                      variant={
                        item.status === "CLOSED"
                          ? "primary"
                          : item.status === "PARTIAL"
                          ? "accent"
                          : "warning"
                      }
                      size="sm"
                    />
                  </View>
                </View>
              </Card>
            )}
          />
        )
      ) : activeTab === "expenses" ? (
        expensesLoading && (!localExpenses || expenses.length === 0) ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.listContent, { paddingTop: 8 }]}
          scrollEnabled={false}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <ExpenseSkeletonCard key={i} />
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={progressiveExpenses}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={expRefetching}
              onRefresh={refetchExpenses}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          removeClippedSubviews={Platform.OS === "android"}
          onEndReachedThreshold={0.5}
          onEndReached={loadMoreExpenses}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Receipt size={36} color={colors.textSubtle} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {searchQuery ? "No expenses match your search." : "No expenses recorded."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={styles.cardItem}>
              <View style={styles.expenseRow}>
                {/* Category Badge */}
                <Badge label={item.category} variant="neutral" size="sm" />

                {/* Details */}
                <View style={styles.expenseDetails}>
                  <Text style={[styles.expenseTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.description || item.incurredBy || "Store Expense"}
                  </Text>
                  {item.receiptRef ? (
                    <Text style={[styles.expenseRef, { color: colors.textSubtle }]} numberOfLines={1}>
                      Ref: {item.receiptRef}
                    </Text>
                  ) : null}
                  {item.incurredBy && item.description ? (
                    <Text style={[styles.expenseBy, { color: colors.textSubtle }]} numberOfLines={1}>
                      ({item.incurredBy})
                    </Text>
                  ) : null}
                </View>

                {/* Expense Amount */}
                <Text style={[styles.expenseAmount, { color: colors.danger }]}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            </Card>
          )}
        />
      )
    ) : (
        utilsLoading && (!localUtilities || utilities.length === 0) ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.listContent, { paddingTop: 8 }]}
          scrollEnabled={false}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <UtilitySkeletonCard key={i} />
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={progressiveUtilities}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={utilsRefetching}
              onRefresh={async () => {
                await Promise.all([refetchUtilities(), refetchUtilitySummary()]);
              }}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          initialNumToRender={15}
          maxToRenderPerBatch={15}
          windowSize={5}
          removeClippedSubviews={Platform.OS === "android"}
          onEndReachedThreshold={0.5}
          onEndReached={loadMoreUtilities}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Building2 size={36} color={colors.textSubtle} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {searchQuery ? "No utilities match your search." : "No recurring utilities configured."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={styles.cardItem}>
              <View style={styles.utilityRow}>
                <View style={styles.utilityDetails}>
                  <View style={styles.utilityTitleRow}>
                    <Text
                      style={[
                        styles.utilityTitle,
                        { color: item.active ? colors.text : colors.textSubtle },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {item.syncStatus === "PENDING" && (
                      <Badge variant="warning" label="Pending Sync" size="sm" />
                    )}
                  </View>

                  <View style={styles.utilityMetaRow}>
                    <Badge
                      variant={item.active ? "primary" : "neutral"}
                      label={item.active ? "Active" : "Inactive"}
                      size="sm"
                    />
                    <View
                      style={[
                        styles.timingBadge,
                        {
                          backgroundColor: colors.surfaceRaised,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Calendar size={11} color={colors.textSubtle} />
                      <Text style={[styles.timingText, { color: colors.textMuted }]}>
                        {item.applyTiming === "BEGINNING_OF_MONTH"
                          ? "Beginning (1st)"
                          : "End of month"}
                      </Text>
                    </View>
                    {item.notes ? (
                      <Text
                        style={[styles.utilityNotes, { color: colors.textSubtle }]}
                        numberOfLines={1}
                      >
                        {item.notes}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.utilityRightArea}>
                  <Text
                    style={[
                      styles.utilityAmount,
                      { color: item.active ? colors.primary : colors.textSubtle },
                    ]}
                  >
                    {formatCurrency(item.amount)}
                  </Text>

                  <View style={styles.utilityActionsRow}>
                    <TouchableOpacity
                      onPress={() => {
                        haptics.light();
                        updateUtilityMutation.mutate({
                          id: item.id,
                          req: { active: !item.active },
                        });
                      }}
                      style={[
                        styles.utilityIconBtn,
                        {
                          backgroundColor: item.active ? colors.successLight : colors.surfaceRaised,
                        },
                      ]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel={item.active ? "Deactivate" : "Activate"}
                    >
                      <Power
                        size={14}
                        color={item.active ? colors.success : colors.textSubtle}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        haptics.light();
                        setEditingUtility(item);
                        setUtilName(item.name);
                        setUtilAmount(formatAmountWithCommas(String(item.amount)));
                        setUtilTiming(item.applyTiming);
                        setUtilNotes(item.notes || "");
                        setUtilActive(item.active);
                        setRecordUtilOpen(true);
                      }}
                      style={[
                        styles.utilityIconBtn,
                        { backgroundColor: colors.surfaceRaised },
                      ]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Edit utility"
                    >
                      <Pencil size={14} color={colors.text} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        haptics.light();
                        setDeleteUtilityItem(item);
                      }}
                      style={[
                        styles.utilityIconBtn,
                        { backgroundColor: colors.surfaceRaised },
                      ]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Delete utility"
                    >
                      <Trash2 size={14} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Card>
          )}
        />
      )
    )}


      {/* Record Debt Modal */}
      <Modal
        visible={recordDebtOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setRecordDebtOpen(false)}
      >
        <AnimatedModalBackdrop
          style={styles.modalBackdrop}
          onPressBackdrop={() => setRecordDebtOpen(false)}
        >
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0 }]}>
                Record customer debt
              </Text>
              <TouchableOpacity
                onPress={() => setRecordDebtOpen(false)}
                style={[styles.closeBtn, { backgroundColor: colors.surfaceRaised }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
              Log a new debt balance when a customer buys goods on credit.
            </Text>

            <Input
              label="Customer Name *"
              value={debtCustomerName}
              onChangeText={setDebtCustomerName}
              placeholder="e.g. John Kamau"
            />
            <Input
              label="Phone Number"
              value={debtCustomerPhone}
              onChangeText={setDebtCustomerPhone}
              placeholder="e.g. 0712345678"
              keyboardType="phone-pad"
            />
            <Input
              label="Amount *"
              value={debtAmount}
              onChangeText={(val) => setDebtAmount(formatAmountWithCommas(val))}
              placeholder="0.00"
              keyboardType="numeric"
            />
            <Input
              label="Notes"
              value={debtNotes}
              onChangeText={setDebtNotes}
              placeholder="Optional notes or items taken"
            />

            <View style={styles.modalBtns}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setRecordDebtOpen(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Save Debt"
                loading={createDebtMutation.isPending}
                disabled={!debtCustomerName.trim() || !debtAmount || Number(debtAmount.replace(/,/g, "")) <= 0}
                onPress={() => createDebtMutation.mutate()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </AnimatedModalBackdrop>
      </Modal>

      {/* Settle Debt Modal */}
      <Modal
        visible={Boolean(settleDebtItem)}
        animationType="slide"
        transparent
        onRequestClose={() => setSettleDebtItem(null)}
      >
        <AnimatedModalBackdrop
          style={styles.modalBackdrop}
          onPressBackdrop={() => setSettleDebtItem(null)}
        >
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0 }]}>
                Record debt payment
              </Text>
              <TouchableOpacity
                onPress={() => setSettleDebtItem(null)}
                style={[styles.closeBtn, { backgroundColor: colors.surfaceRaised }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
              Customer: {settleDebtItem?.customerName} · Current Balance:{" "}
              {formatCurrency(settleDebtItem?.outstanding)}
            </Text>

            <Input
              label="Payment Amount *"
              value={settleAmount}
              onChangeText={(val) => setSettleAmount(formatAmountWithCommas(val))}
              placeholder="0.00"
              keyboardType="numeric"
            />

            <View style={styles.modalBtns}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setSettleDebtItem(null)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Confirm Payment"
                loading={settleDebtMutation.isPending}
                disabled={!settleAmount || Number(settleAmount.replace(/,/g, "")) <= 0}
                onPress={() => settleDebtMutation.mutate()}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        </AnimatedModalBackdrop>
      </Modal>

      {/* Record Expense Modal */}
      <Modal
        visible={recordExpOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setRecordExpOpen(false)}
      >
        <AnimatedModalBackdrop
          style={styles.modalBackdrop}
          onPressBackdrop={() => setRecordExpOpen(false)}
        >
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0 }]}>
                Record store expense
              </Text>
              <TouchableOpacity
                onPress={() => setRecordExpOpen(false)}
                style={[styles.closeBtn, { backgroundColor: colors.surfaceRaised }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
              Log operational store disbursements like supplies, utilities, or repairs.
            </Text>

            <Input
              label="Amount *"
              value={expAmount}
              onChangeText={(val) => setExpAmount(formatAmountWithCommas(val))}
              placeholder="0.00"
              keyboardType="numeric"
            />
            <Input
              label="Category *"
              value={expCategory}
              onChangeText={setExpCategory}
              placeholder="e.g. Supplies, Transport"
            />
            <Input
              label="Description *"
              value={expDescription}
              onChangeText={setExpDescription}
              placeholder="e.g. Cleaning detergent and brooms"
            />
            <Input
              label="Incurred By"
              value={expIncurredBy}
              onChangeText={setExpIncurredBy}
              placeholder="e.g. Cashier"
            />
            <Input
              label="Receipt Reference"
              value={expReceiptRef}
              onChangeText={setExpReceiptRef}
              placeholder="e.g. REC-9482"
            />

            <View style={styles.modalBtns}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setRecordExpOpen(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Save Expense"
                loading={createExpMutation.isPending}
                disabled={!expAmount || !expDescription.trim() || Number(expAmount.replace(/,/g, "")) <= 0}
                onPress={() => createExpMutation.mutate()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </AnimatedModalBackdrop>
      </Modal>

      {/* Record / Edit Recurring Utility Modal */}
      <Modal
        visible={recordUtilOpen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setRecordUtilOpen(false);
          setEditingUtility(null);
        }}
      >
        <AnimatedModalBackdrop
          style={styles.modalBackdrop}
          onPressBackdrop={() => {
            setRecordUtilOpen(false);
            setEditingUtility(null);
          }}
        >
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0 }]}>
                {editingUtility ? "Edit recurring utility" : "Add recurring utility"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setRecordUtilOpen(false);
                  setEditingUtility(null);
                }}
                style={[styles.closeBtn, { backgroundColor: colors.surfaceRaised }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Top row: Utility Name (50%) and Amount (50%) side by side */}
            <View style={styles.utilityInputsRow}>
              <View style={styles.utilityHalfCol}>
                <UtilityPresetSelector
                  label="Utility name *"
                  value={utilName}
                  onChange={setUtilName}
                  orgId={orgId!}
                  branchId={branchId!}
                />
              </View>

              <View style={styles.utilityHalfCol}>
                <Input
                  label="Amount *"
                  value={utilAmount}
                  onChangeText={(val) => setUtilAmount(formatAmountWithCommas(val))}
                  placeholder="0.00"
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Apply timing: side-by-side radio options without small descriptions */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>
                Apply on *
              </Text>
              <View style={styles.timingRadioRow}>
                <TouchableOpacity
                  onPress={() => {
                    haptics.selection();
                    setUtilTiming("BEGINNING_OF_MONTH");
                  }}
                  activeOpacity={0.8}
                  style={[
                    styles.timingRadioOption,
                    {
                      backgroundColor:
                        utilTiming === "BEGINNING_OF_MONTH"
                          ? colors.primaryLight
                          : colors.surfaceRaised,
                      borderColor:
                        utilTiming === "BEGINNING_OF_MONTH"
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.radioCircle,
                      {
                        borderColor:
                          utilTiming === "BEGINNING_OF_MONTH"
                            ? colors.primary
                            : colors.textSubtle,
                      },
                    ]}
                  >
                    {utilTiming === "BEGINNING_OF_MONTH" && (
                      <View
                        style={[
                          styles.radioDot,
                          { backgroundColor: colors.primary },
                        ]}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.timingRadioLabel,
                      {
                        color:
                          utilTiming === "BEGINNING_OF_MONTH"
                            ? colors.primary
                            : colors.text,
                        fontWeight:
                          utilTiming === "BEGINNING_OF_MONTH" ? "700" : "500",
                      },
                    ]}
                  >
                    Beginning of month (1st)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    haptics.selection();
                    setUtilTiming("END_OF_MONTH");
                  }}
                  activeOpacity={0.8}
                  style={[
                    styles.timingRadioOption,
                    {
                      backgroundColor:
                        utilTiming === "END_OF_MONTH"
                          ? colors.primaryLight
                          : colors.surfaceRaised,
                      borderColor:
                        utilTiming === "END_OF_MONTH"
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.radioCircle,
                      {
                        borderColor:
                          utilTiming === "END_OF_MONTH"
                            ? colors.primary
                            : colors.textSubtle,
                      },
                    ]}
                  >
                    {utilTiming === "END_OF_MONTH" && (
                      <View
                        style={[
                          styles.radioDot,
                          { backgroundColor: colors.primary },
                        ]}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.timingRadioLabel,
                      {
                        color:
                          utilTiming === "END_OF_MONTH"
                            ? colors.primary
                            : colors.text,
                        fontWeight:
                          utilTiming === "END_OF_MONTH" ? "700" : "500",
                      },
                    ]}
                  >
                    End of month (last day)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <Input
              label="Notes"
              value={utilNotes}
              onChangeText={setUtilNotes}
              placeholder="Optional notes or account/meter ref"
            />

            <View style={styles.modalBtns}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  setRecordUtilOpen(false);
                  setEditingUtility(null);
                }}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title={editingUtility ? "Save changes" : "Save utility"}
                loading={createUtilityMutation.isPending || updateUtilityMutation.isPending}
                disabled={!utilName.trim() || !utilAmount || parseFloat(utilAmount.replace(/,/g, "")) <= 0}
                onPress={() => {
                  if (editingUtility) {
                    updateUtilityMutation.mutate({
                      id: editingUtility.id,
                      req: {
                        name: utilName.trim(),
                        amount: parseFloat(utilAmount.replace(/,/g, "")),
                        applyTiming: utilTiming,
                        notes: utilNotes.trim() || undefined,
                        active: utilActive,
                      },
                    });
                  } else {
                    createUtilityMutation.mutate();
                  }
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </AnimatedModalBackdrop>
      </Modal>

      {/* Delete Utility Confirmation Modal */}
      <Modal
        visible={Boolean(deleteUtilityItem)}
        animationType="fade"
        transparent
        onRequestClose={() => setDeleteUtilityItem(null)}
      >
        <AnimatedModalBackdrop
          style={styles.modalBackdrop}
          onPressBackdrop={() => setDeleteUtilityItem(null)}
        >
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0 }]}>
                Delete recurring utility
              </Text>
              <TouchableOpacity
                onPress={() => setDeleteUtilityItem(null)}
                style={[styles.closeBtn, { backgroundColor: colors.surfaceRaised }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
              Are you sure you want to delete "{deleteUtilityItem?.name}" ({formatCurrency(deleteUtilityItem?.amount)})? This will remove the utility overhead.
            </Text>

            <View style={styles.modalBtns}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setDeleteUtilityItem(null)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Delete"
                variant="danger"
                loading={deleteUtilityMutation.isPending}
                onPress={() => {
                  if (deleteUtilityItem) {
                    deleteUtilityMutation.mutate(deleteUtilityItem.id);
                  }
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </AnimatedModalBackdrop>
      </Modal>

      {/* Date Picker Modal for Custom date range selection */}
      <DatePickerModal
        visible={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        value={pickerTarget === "start" ? customStartDate : customEndDate}
        title={pickerTarget === "start" ? "Select Start Date" : "Select End Date"}
        onSelectDate={(picked) => {
          if (pickerTarget === "start") {
            setCustomStartDate(picked);
            if (customEndDate && picked > customEndDate) {
              setCustomEndDate(picked);
            }
          } else {
            setCustomEndDate(picked);
            if (customStartDate && picked < customStartDate) {
              setCustomStartDate(picked);
            }
          }
          setPickerTarget(null);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  searchBox: {
    flex: 1,
  },
  totalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 72,
  },
  totalLabel: {
    fontSize: 8,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  totalVal: {
    fontSize: 12,
    fontWeight: "800",
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    height: 36,
  },
  refreshToolbarBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  filterBar: {
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  filterChipsRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11,
  },
  customRangeBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 10,
    marginTop: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  dateTriggerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  dateTriggerLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  dateTriggerVal: {
    fontSize: 11,
    fontWeight: "700",
  },
  rangeArrow: {
    fontSize: 12,
    fontWeight: "700",
  },
  listContent: {
    padding: 10,
    paddingBottom: 24,
    gap: 6,
  },
  cardItem: {
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  debtRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  debtColCustomer: {
    width: 75,
    justifyContent: "center",
  },
  debtCustomerName: {
    fontSize: 13,
    fontWeight: "700",
  },
  debtCustomerPhone: {
    fontSize: 9,
    marginTop: 1,
  },
  debtColBal: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  debtColSet: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  debtColAction: {
    width: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  debtColStatus: {
    width: 65,
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabelSmall: {
    fontSize: 8,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  metricBalVal: {
    fontSize: 12,
    fontWeight: "800",
  },
  metricSetVal: {
    fontSize: 11,
    fontWeight: "600",
  },
  repayBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    width: 44,
  },
  repayBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  expenseDetails: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    overflow: "hidden",
  },
  expenseTitle: {
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  expenseRef: {
    fontSize: 11,
    flexShrink: 1,
  },
  expenseBy: {
    fontSize: 11,
    flexShrink: 1,
  },
  expenseAmount: {
    fontSize: 13,
    fontWeight: "800",
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
    paddingVertical: 48,
    alignItems: "center",
    gap: 8,
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
    padding: 16,
    borderTopWidth: 1,
    width: "100%",
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
  modalBtns: {
    flexDirection: "row",
    marginTop: 16,
    paddingBottom: 8,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  utilityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  utilityDetails: {
    flex: 1,
    gap: 4,
  },
  utilityTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  utilityTitle: {
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  utilityMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  timingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  timingText: {
    fontSize: 10,
    fontWeight: "600",
  },
  utilityNotes: {
    fontSize: 10,
    fontStyle: "italic",
    flexShrink: 1,
  },
  utilityRightArea: {
    alignItems: "flex-end",
    gap: 4,
  },
  utilityAmount: {
    fontSize: 13,
    fontWeight: "800",
  },
  utilityActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  utilityIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldContainer: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 6,
  },
  utilityInputsRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  utilityHalfCol: {
    flex: 1,
  },
  timingRadioRow: {
    flexDirection: "row",
    gap: 8,
  },
  timingRadioOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timingRadioLabel: {
    fontSize: 12,
    flexShrink: 1,
  },
});
