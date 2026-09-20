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
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import type { CustomerDebtResponse, MiscExpenseResponse } from "@/types";
import { formatCurrency } from "@/utils/formatCurrency";
import { haptics } from "@/utils/haptics";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { DatePickerModal } from "@/components/ui/DatePickerModal";

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


export const DebtsExpensesScreen: React.FC = () => {
  const { colors } = useTheme();
  const { token } = useAuth();
  const { orgId, branchId } = useOrg();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"debts" | "expenses">("debts");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("OUTSTANDING");

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

  const {
    data: debtsPages,
    isLoading: debtsLoading,
    isFetchingNextPage: debtsFetchingNext,
    hasNextPage: debtsHasNext,
    fetchNextPage: debtsFetchNext,
    isRefetching: debtsRefetching,
    refetch: refetchDebts,
  } = useInfiniteQuery({
    queryKey: [
      "debts-list",
      token,
      orgId,
      branchId,
      statusFilter,
      effectiveStartDate,
      effectiveEndDate,
    ],
    queryFn: ({ pageParam = 0 }) =>
      fetchDebts(token, orgId!, branchId!, {
        page: pageParam as number,
        size: PAGE_SIZE,
        sort: "createdAt,desc",
        status: statusParam,
        fromDate: effectiveStartDate,
        toDate: effectiveEndDate,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.last ? undefined : (lastPage.number ?? 0) + 1,
    initialPageParam: 0,
    enabled: Boolean(token && orgId && branchId && activeTab === "debts"),
  });
  const debts = useMemo(
    () => debtsPages?.pages.flatMap((p) => p.content) ?? [],
    [debtsPages]
  );

  // Queries: Expenses
  const {
    data: expensesPages,
    isLoading: expensesLoading,
    isFetchingNextPage: expFetchingNext,
    hasNextPage: expHasNext,
    fetchNextPage: expFetchNext,
    isRefetching: expRefetching,
    refetch: refetchExpenses,
  } = useInfiniteQuery({
    queryKey: [
      "expenses-list",
      token,
      orgId,
      branchId,
      effectiveStartDate,
      effectiveEndDate,
    ],
    queryFn: ({ pageParam = 0 }) =>
      fetchMiscExpenses(token, orgId!, branchId!, {
        page: pageParam as number,
        size: PAGE_SIZE,
        sort: "createdAt,desc",
        fromDate: effectiveStartDate,
        toDate: effectiveEndDate,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.number + 1 >= lastPage.totalPages
        ? undefined
        : lastPage.number + 1,
    initialPageParam: 0,
    enabled: Boolean(token && orgId && branchId && activeTab === "expenses"),
  });
  const expenses = useMemo(
    () => expensesPages?.pages.flatMap((p) => p.content) ?? [],
    [expensesPages]
  );

  // Queries: Expense Categories
  const { data: expenseCategories = ["Supplies", "Utilities", "Wages", "Transport", "Other"] } =
    useQuery({
      queryKey: ["expense-categories", token, orgId, branchId],
      queryFn: () => fetchExpenseCategories(token, orgId!, branchId!),
      enabled: Boolean(token && orgId && branchId),
    });

  // Create Debt Mutation
  const createDebtMutation = useMutation({
    mutationFn: () =>
      createDebt(token, orgId!, branchId!, {
        customerId: `temp-${Date.now()}`,
        customerName: debtCustomerName.trim(),
        customerPhone: debtCustomerPhone.trim() || undefined,
        amount: Number(debtAmount),
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
      void refetchDebts();
      void queryClient.invalidateQueries({ queryKey: ["debts-pending-total"] });
      Alert.alert("Success", "Debt recorded successfully.");
    },
    onError: (err: any) => {
      haptics.error();
      Alert.alert("Error", err?.data?.message ?? "Failed to record debt.");
    },
  });

  // Settle Debt Mutation
  const settleDebtMutation = useMutation({
    mutationFn: () =>
      settleDebt(token, orgId!, branchId!, settleDebtItem!.id, Number(settleAmount)),
    onSuccess: () => {
      haptics.success();
      setSettleDebtItem(null);
      setSettleAmount("");
      void refetchDebts();
      void queryClient.invalidateQueries({ queryKey: ["debts-pending-total"] });
      Alert.alert("Success", "Payment recorded successfully.");
    },
    onError: (err: any) => {
      haptics.error();
      Alert.alert("Error", err?.data?.message ?? "Failed to settle payment.");
    },
  });

  // Create Expense Mutation
  const createExpMutation = useMutation({
    mutationFn: () =>
      createMiscExpense(token, orgId!, branchId!, {
        amount: Number(expAmount),
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
      void refetchExpenses();
      Alert.alert("Success", "Expense recorded successfully.");
    },
    onError: (err: any) => {
      haptics.error();
      Alert.alert("Error", err?.data?.message ?? "Failed to record expense.");
    },
  });

  // Debts Pending Total query
  const { data: debtPendingTotalData, refetch: refetchPendingTotal } = useQuery({
    queryKey: ["debts-pending-total", token, orgId, branchId],
    queryFn: () => fetchDebtPendingTotal(token, orgId!, branchId!),
    enabled: Boolean(token && orgId && branchId && activeTab === "debts"),
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
    } else {
      if (searchQuery.trim() || datePreset !== "all") {
        return filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      }
      const pageTotal = expensesPages?.pages?.[0]?.totalAmount;
      return typeof pageTotal === "number"
        ? pageTotal
        : expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    }
  }, [
    activeTab,
    searchQuery,
    datePreset,
    filteredDebts,
    debtPendingTotalData,
    debts,
    filteredExpenses,
    expensesPages,
    expenses,
  ]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Segmented Tab Control */}
      <View style={[styles.topBar, { backgroundColor: colors.surface }]}>
        <SegmentedControl
          options={[
            { id: "debts", label: "Customer Debts", icon: <HandCoins size={16} color={colors.text} /> },
            { id: "expenses", label: "Store Expenses", icon: <Receipt size={16} color={colors.text} /> },
          ]}
          activeId={activeTab}
          onChange={(tab) => {
            setActiveTab(tab);
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
              activeTab === "debts" ? "Search debts…" : "Search expenses…"
            }
            leftIcon={<Search size={15} color={colors.textSubtle} />}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>

        <View
          style={[
            styles.totalBadge,
            {
              backgroundColor: activeTab === "debts" ? colors.warningLight : colors.dangerLight,
              borderColor: activeTab === "debts" ? colors.warning : colors.danger,
            },
          ]}
        >
          <Text style={[styles.totalLabel, { color: colors.textSubtle }]}>TOTAL</Text>
          <Text
            style={[
              styles.totalVal,
              { color: activeTab === "debts" ? colors.warning : colors.danger },
            ]}
            numberOfLines={1}
          >
            {formatCurrency(currentTotal)}
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
        ) : (
          <Button
            title="+ Expense"
            size="sm"
            onPress={() => {
              haptics.light();
              setRecordExpOpen(true);
            }}
            style={styles.actionBtn}
          />
        )}

        <TouchableOpacity
          onPress={async () => {
            haptics.light();
            if (activeTab === "debts") {
              await Promise.all([refetchDebts(), refetchPendingTotal()]);
            } else {
              await Promise.all([refetchExpenses()]);
            }
          }}
          disabled={activeTab === "debts" ? debtsRefetching : expRefetching}
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
          {(activeTab === "debts" ? debtsRefetching : expRefetching) ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <RefreshCw size={15} color={colors.text} />
          )}
        </TouchableOpacity>
      </View>

      {/* Date Filter Chips (Single row under search input) */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          {(
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
          })}
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
        debtsLoading ? (
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
            data={filteredDebts}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={debtsRefetching}
                onRefresh={refetchDebts}
                tintColor={colors.primary}
              />
            }
            contentContainerStyle={styles.listContent}
            onEndReachedThreshold={0.3}
            onEndReached={() => {
              if (debtsHasNext && !debtsFetchingNext) {
                void debtsFetchNext();
              }
            }}
            ListFooterComponent={
              debtsFetchingNext ? (
                <View style={{ paddingVertical: 12, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null
            }
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
                          setSettleAmount(String(item.outstanding));
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
      ) : expensesLoading ? (
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
          data={filteredExpenses}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={expRefetching}
              onRefresh={refetchExpenses}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          onEndReachedThreshold={0.3}
          onEndReached={() => {
            if (expHasNext && !expFetchingNext) {
              void expFetchNext();
            }
          }}
          ListFooterComponent={
            expFetchingNext ? (
              <View style={{ paddingVertical: 12, alignItems: "center" }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
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
      )}


      {/* Record Debt Modal */}
      <Modal visible={recordDebtOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Record Customer Debt
            </Text>
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
              onChangeText={setDebtAmount}
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
                disabled={!debtCustomerName.trim() || !debtAmount}
                onPress={() => createDebtMutation.mutate()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Settle Debt Modal */}
      <Modal visible={Boolean(settleDebtItem)} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Record Debt Payment
            </Text>
            <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
              Customer: {settleDebtItem?.customerName} · Current Balance:{" "}
              {formatCurrency(settleDebtItem?.outstanding)}
            </Text>

            <Input
              label="Payment Amount *"
              value={settleAmount}
              onChangeText={setSettleAmount}
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
                disabled={!settleAmount || Number(settleAmount) <= 0}
                onPress={() => settleDebtMutation.mutate()}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Record Expense Modal */}
      <Modal visible={recordExpOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Record Store Expense
            </Text>
            <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
              Log operational store disbursements like supplies, utilities, or repairs.
            </Text>

            <Input
              label="Amount *"
              value={expAmount}
              onChangeText={setExpAmount}
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
                disabled={!expAmount || !expDescription.trim()}
                onPress={() => createExpMutation.mutate()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
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
  modalBtns: {
    flexDirection: "row",
    marginTop: 16,
    paddingBottom: 16,
  },
});
