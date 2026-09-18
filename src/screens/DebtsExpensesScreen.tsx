import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  HandCoins,
  Receipt,
  Plus,
  Search,
  CheckCircle2,
  Calendar,
  Phone,
  User,
} from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useOrg } from "@/context/OrgContext";
import {
  fetchDebts,
  createDebt,
  settleDebt,
  fetchDebtPendingTotal,
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
import { StatCard } from "@/components/ui/StatCard";

export const DebtsExpensesScreen: React.FC = () => {
  const { colors } = useTheme();
  const { token } = useAuth();
  const { orgId, branchId } = useOrg();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"debts" | "expenses">("debts");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("OUTSTANDING");

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

  // Queries: Pending total
  const { data: pendingTotalData } = useQuery({
    queryKey: ["debts-pending-total", token, orgId, branchId],
    queryFn: () => fetchDebtPendingTotal(token, orgId!, branchId!),
    enabled: Boolean(token && orgId && branchId),
  });

  // Queries: Debts
  const statusParam =
    statusFilter === "OUTSTANDING"
      ? ["OPEN", "PARTIAL"]
      : statusFilter === "ALL"
      ? ["OPEN", "PARTIAL", "CLOSED"]
      : statusFilter;

  const {
    data: debtsData,
    isLoading: debtsLoading,
    isRefetching: debtsRefetching,
    refetch: refetchDebts,
  } = useQuery({
    queryKey: ["debts-list", token, orgId, branchId, statusFilter],
    queryFn: () =>
      fetchDebts(token, orgId!, branchId!, {
        size: 150,
        sort: "createdAt,desc",
        status: statusParam,
      }),
    enabled: Boolean(token && orgId && branchId && activeTab === "debts"),
  });
  const debts = debtsData?.content ?? [];

  // Queries: Expenses
  const {
    data: expensesData,
    isLoading: expensesLoading,
    isRefetching: expRefetching,
    refetch: refetchExpenses,
  } = useQuery({
    queryKey: ["expenses-list", token, orgId, branchId],
    queryFn: () =>
      fetchMiscExpenses(token, orgId!, branchId!, {
        size: 150,
        sort: "createdAt,desc",
      }),
    enabled: Boolean(token && orgId && branchId && activeTab === "expenses"),
  });
  const expenses = expensesData?.content ?? [];

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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

      {/* Primary KPI Header Strip */}
      <View style={styles.kpiContainer}>
        {activeTab === "debts" ? (
          <StatCard
            label="Total Pending Debts"
            value={formatCurrency(pendingTotalData?.totalPending ?? 0)}
            subtitle="Owed by customers to this branch"
            variant="warning"
            icon={<HandCoins size={22} color={colors.warning} />}
          />
        ) : (
          <StatCard
            label="Total Expenses"
            value={formatCurrency(expensesData?.totalAmount ?? 0)}
            subtitle={`${expenses.length} expenses logged`}
            variant="danger"
            icon={<Receipt size={22} color={colors.danger} />}
          />
        )}
      </View>

      {/* Toolbar: Search + Action Button */}
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Input
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={
              activeTab === "debts" ? "Search customer name or phone…" : "Search expenses…"
            }
            leftIcon={<Search size={16} color={colors.textSubtle} />}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>

        {activeTab === "debts" ? (
          <Button
            title="+ Debt"
            onPress={() => {
              haptics.light();
              setRecordDebtOpen(true);
            }}
          />
        ) : (
          <Button
            title="+ Expense"
            onPress={() => {
              haptics.light();
              setRecordExpOpen(true);
            }}
          />
        )}
      </View>

      {/* Content Lists */}
      {activeTab === "debts" ? (
        debtsLoading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Loading customer debts…
            </Text>
          </View>
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
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <HandCoins size={40} color={colors.textSubtle} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  {searchQuery ? "No debts match your search." : "No active customer debts."}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Card style={styles.cardItem}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>
                      {item.customerName}
                    </Text>
                    {item.customerPhone ? (
                      <View style={styles.phoneRow}>
                        <Phone size={12} color={colors.textSubtle} />
                        <Text style={[styles.phoneText, { color: colors.textSubtle }]}>
                          {item.customerPhone}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Badge
                    label={item.status}
                    variant={
                      item.status === "CLOSED"
                        ? "primary"
                        : item.status === "PARTIAL"
                        ? "accent"
                        : "warning"
                    }
                  />
                </View>

                {/* Amounts & Due date */}
                <View style={styles.amountsRow}>
                  <View style={styles.amountCol}>
                    <Text style={[styles.amountLabel, { color: colors.textSubtle }]}>
                      Outstanding
                    </Text>
                    <Text style={[styles.amountOwed, { color: colors.warning }]}>
                      {formatCurrency(item.outstanding)}
                    </Text>
                  </View>
                  <View style={styles.amountCol}>
                    <Text style={[styles.amountLabel, { color: colors.textSubtle }]}>
                      Settled
                    </Text>
                    <Text style={[styles.amountVal, { color: colors.textMuted }]}>
                      {formatCurrency(item.amountSettled)} / {formatCurrency(item.amount)}
                    </Text>
                  </View>
                </View>

                {/* Settle Action Button */}
                {item.outstanding > 0 ? (
                  <Button
                    title="Record Payment"
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      haptics.light();
                      setSettleDebtItem(item);
                      setSettleAmount(String(item.outstanding));
                    }}
                    style={{ marginTop: 10 }}
                  />
                ) : null}
              </Card>
            )}
          />
        )
      ) : expensesLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading store expenses…
          </Text>
        </View>
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
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Receipt size={40} color={colors.textSubtle} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {searchQuery ? "No expenses match your search." : "No expenses recorded."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={styles.cardItem}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {item.description}
                  </Text>
                  <Text style={[styles.phoneText, { color: colors.textSubtle }]}>
                    {item.incurredBy ? `By: ${item.incurredBy}` : ""} · Ref:{" "}
                    {item.receiptRef || "N/A"}
                  </Text>
                </View>
                <Text style={[styles.expenseAmount, { color: colors.danger }]}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>
              <View style={{ marginTop: 8 }}>
                <Badge label={item.category} variant="neutral" size="sm" />
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
              label="Amount (KSH) *"
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
              label="Payment Amount (KSH) *"
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
              label="Amount (KSH) *"
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
  kpiContainer: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  searchBox: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 10,
  },
  cardItem: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  phoneText: {
    fontSize: 12,
  },
  amountsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  amountCol: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  amountOwed: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  amountVal: {
    fontSize: 13,
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: 16,
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
