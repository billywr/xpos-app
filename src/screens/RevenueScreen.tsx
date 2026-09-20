import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  DollarSign,
  Package,
  Receipt,
  ShoppingBag,
  Calendar,
  AlertTriangle,
  RotateCw,
  Percent,
  CreditCard,
  X,
} from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useOrg } from "@/context/OrgContext";
import { fetchRevenueDashboard, type RevenueTrendPointResponse } from "@/api/revenueDashboard";
import { fetchMiscExpenses } from "@/api/miscExpenses";
import { formatCurrency } from "@/utils/formatCurrency";
import { haptics } from "@/utils/haptics";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { DatePickerModal } from "@/components/ui/DatePickerModal";

// ---------------------------------------------------------------------------
// Skeleton layout for the Revenue dashboard (6 stat cards + trend rows)
// ---------------------------------------------------------------------------
const RevenueSkeleton: React.FC = () => {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
      {/* 3×2 stat card grid */}
      {[0, 1, 2].map((row) => (
        <View key={row} style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          {[0, 1].map((col) => (
            <View
              key={col}
              style={{
                flex: 1,
                borderRadius: 16,
                padding: 14,
                gap: 10,
                backgroundColor: colors.surfaceCard,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <SkeletonBlock width={80} height={11} radius={5} />
              <SkeletonBlock width="65%" height={22} radius={7} />
              <SkeletonBlock width={60} height={10} radius={4} />
            </View>
          ))}
        </View>
      ))}
      {/* Trend row skeletons */}
      {Array.from({ length: 5 }).map((_, i) => (
        <View
          key={i}
          style={{
            borderRadius: 14,
            padding: 12,
            marginBottom: 8,
            backgroundColor: colors.surfaceCard,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <SkeletonBlock width={100} height={13} radius={5} />
            <SkeletonBlock width={50} height={20} radius={10} />
          </View>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <SkeletonBlock width={70} height={12} radius={5} />
            <SkeletonBlock width={60} height={12} radius={5} />
            <SkeletonBlock width={65} height={12} radius={5} />
          </View>
        </View>
      ))}
    </View>
  );
};

type PresetRange = "today" | "7days" | "30days" | "thisMonth" | "custom";

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toLocalDateStr(isoString: string): string {
  try {
    const d = new Date(isoString);
    return formatLocalDate(d);
  } catch {
    return isoString.slice(0, 10);
  }
}

function getRangeDates(preset: PresetRange): { start: string; end: string } {
  const now = new Date();
  const today = formatLocalDate(now);

  if (preset === "today") {
    return { start: today, end: today };
  }
  if (preset === "7days") {
    const s = new Date(now);
    s.setDate(s.getDate() - 7);
    return { start: formatLocalDate(s), end: today };
  }
  if (preset === "thisMonth") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: formatLocalDate(s), end: today };
  }
  // 30days default
  const s = new Date(now);
  s.setDate(s.getDate() - 30);
  return { start: formatLocalDate(s), end: today };
}

export const RevenueScreen: React.FC = () => {
  const { colors } = useTheme();
  const { token } = useAuth();
  const { orgId, branchId, branchName } = useOrg();

  const [activePreset, setActivePreset] = useState<PresetRange>("30days");
  const initialDates = useMemo(() => getRangeDates("30days"), []);

  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);
  const [dateNotice, setDateNotice] = useState<string | null>(null);
  const [pickerTarget, setPickerTarget] = useState<"start" | "end" | null>(null);

  // Expense breakdown modal & filter states
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");

  const selectPreset = (preset: PresetRange) => {
    haptics.light();
    setActivePreset(preset);
    setDateNotice(null);
    if (preset !== "custom") {
      const r = getRangeDates(preset);
      setStartDate(r.start);
      setEndDate(r.end);
    }
  };

  const handleStartDateChange = (val: string) => {
    const trimmed = val.trim();
    if (endDate && trimmed && trimmed > endDate) {
      setStartDate(trimmed);
      setEndDate(trimmed);
      setDateNotice("Start date cannot be after end date. End date adjusted.");
      haptics.warning();
      return;
    }
    setDateNotice(null);
    setStartDate(trimmed);
  };

  const handleEndDateChange = (val: string) => {
    const trimmed = val.trim();
    if (startDate && trimmed && trimmed < startDate) {
      setStartDate(trimmed);
      setEndDate(trimmed);
      setDateNotice("End date cannot be before start date. Start date adjusted.");
      haptics.warning();
      return;
    }
    setDateNotice(null);
    setEndDate(trimmed);
  };

  const {
    data: dashboard,
    isLoading: isDashLoading,
    isRefetching: isDashRefetching,
    isError,
    error,
    refetch: refetchDashboard,
  } = useQuery({
    queryKey: [
      "mobile-revenue-dashboard",
      token,
      orgId,
      branchId,
      startDate,
      endDate,
    ],
    queryFn: () =>
      fetchRevenueDashboard(token, orgId!, branchId!, startDate, endDate),
    enabled: Boolean(token && orgId && branchId && startDate && endDate),
  });

  const {
    data: expensesData,
    isLoading: isExpLoading,
    isRefetching: isExpRefetching,
    refetch: refetchExpenses,
  } = useQuery({
    queryKey: [
      "mobile-revenue-expenses",
      token,
      orgId,
      branchId,
      startDate,
      endDate,
    ],
    queryFn: () =>
      fetchMiscExpenses(token, orgId!, branchId!, {
        fromDate: startDate,
        toDate: endDate,
        size: 500,
      }),
    enabled: Boolean(token && orgId && branchId && startDate && endDate),
  });

  const isLoading = isDashLoading || isExpLoading;
  const isRefetching = isDashRefetching || isExpRefetching;

  const handleRefreshAll = async () => {
    haptics.light();
    await Promise.all([refetchDashboard(), refetchExpenses()]);
  };

  const expenseTotal = useMemo(() => {
    const fromApi = Number(expensesData?.totalAmount ?? 0);
    const fromDash = Number(dashboard?.summary?.expenseTotal ?? 0);
    return fromApi > 0 ? fromApi : fromDash;
  }, [expensesData?.totalAmount, dashboard?.summary?.expenseTotal]);

  const grossProfit = useMemo(() => {
    if (!dashboard?.summary) return 0;
    const { revenueTotal, cogsTotal } = dashboard.summary;
    return revenueTotal - cogsTotal;
  }, [dashboard]);

  const grossMarginPercent = useMemo(() => {
    if (!dashboard?.summary || dashboard.summary.revenueTotal <= 0) return 0;
    return (grossProfit / dashboard.summary.revenueTotal) * 100;
  }, [dashboard, grossProfit]);

  const netProfit = useMemo(() => {
    if (!dashboard?.summary) return 0;
    const { revenueTotal, cogsTotal } = dashboard.summary;
    return revenueTotal - cogsTotal - expenseTotal;
  }, [dashboard, expenseTotal]);

  const marginPercent = useMemo(() => {
    if (!dashboard?.summary || dashboard.summary.revenueTotal <= 0) return 0;
    return (netProfit / dashboard.summary.revenueTotal) * 100;
  }, [dashboard, netProfit]);

  const expenseCategoriesSummary = useMemo(() => {
    const list = expensesData?.content ?? [];
    const map: Record<string, { count: number; total: number }> = {};
    for (const exp of list) {
      const cat = exp.category || "General";
      if (!map[cat]) map[cat] = { count: 0, total: 0 };
      map[cat].count += 1;
      map[cat].total += Number(exp.amount || 0);
    }
    const total = Number(expensesData?.totalAmount || expenseTotal || 0);
    return Object.entries(map)
      .map(([category, data]) => ({
        category,
        count: data.count,
        total: data.total,
        percentage: total > 0 ? (data.total / total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [expensesData?.content, expensesData?.totalAmount, expenseTotal]);

  const filteredExpenses = useMemo(() => {
    let list = expensesData?.content ?? [];
    if (selectedCategoryFilter !== "ALL") {
      list = list.filter((e) => (e.category || "General") === selectedCategoryFilter);
    }
    if (expenseSearch.trim()) {
      const q = expenseSearch.toLowerCase();
      list = list.filter(
        (e) =>
          e.description?.toLowerCase().includes(q) ||
          e.category?.toLowerCase().includes(q) ||
          e.incurredBy?.toLowerCase().includes(q) ||
          e.receiptRef?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [expensesData?.content, selectedCategoryFilter, expenseSearch]);

  const dailyExpensesMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (expensesData?.content) {
      for (const exp of expensesData.content) {
        if (!exp.createdAt || exp.amount == null) continue;
        const d = toLocalDateStr(exp.createdAt);
        map[d] = (map[d] ?? 0) + Number(exp.amount);
      }
    }
    return map;
  }, [expensesData?.content]);

  const sortedTrend = useMemo(() => {
    const pointsMap: Record<string, RevenueTrendPointResponse> = {};
    if (dashboard?.trend) {
      for (const p of dashboard.trend) {
        pointsMap[p.date] = { ...p };
      }
    }
    // Merge daily expenses if point has 0 or undefined expenses
    for (const [dateStr, expAmt] of Object.entries(dailyExpensesMap)) {
      if (pointsMap[dateStr]) {
        const currentExp = pointsMap[dateStr].expenses ?? 0;
        const finalExp = currentExp > 0 ? currentExp : expAmt;
        const rev = pointsMap[dateStr].revenue;
        const cogs = pointsMap[dateStr].cogs;
        pointsMap[dateStr] = {
          ...pointsMap[dateStr],
          expenses: finalExp,
          netProfit: rev - cogs - finalExp,
        };
      } else {
        // A day with expenses but 0 sales
        pointsMap[dateStr] = {
          date: dateStr,
          revenue: 0,
          tax: 0,
          cogs: 0,
          expenses: expAmt,
          netProfit: -expAmt,
          saleCount: 0,
        };
      }
    }
    return Object.values(pointsMap).sort((a, b) => b.date.localeCompare(a.date));
  }, [dashboard?.trend, dailyExpensesMap]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        decelerationRate={Platform.OS === "ios" ? "normal" : 0.985}
        bounces={true}
        alwaysBounceVertical={true}
        overScrollMode="never"
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefreshAll}
            tintColor={colors.primary}
          />
        }
      >
        {/* Title & Subtitle */}
        <View style={styles.header}>
          <View style={styles.titleHeaderRow}>
            <View style={styles.titleRow}>
              <TrendingUp size={22} color={colors.primary} />
              <Text style={[styles.title, { color: colors.text }]}>Revenue & P&L</Text>
            </View>
            <TouchableOpacity
              onPress={handleRefreshAll}
              disabled={isRefetching}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Refresh revenue data"
              style={[
                styles.headerRefreshBtn,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.border,
                },
              ]}
            >
              {isRefetching ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <RotateCw size={16} color={colors.text} />
              )}
            </TouchableOpacity>
          </View>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {branchName ? `${branchName} • ` : ""}Profit & loss tracking with daily trends
          </Text>
        </View>

        {/* Preset Selector Chips */}
        <View style={styles.presetRow}>
          {(
            [
              { key: "today", label: "Today" },
              { key: "7days", label: "7 Days" },
              { key: "30days", label: "30 Days" },
              { key: "thisMonth", label: "This Month" },
              { key: "custom", label: "Custom" },
            ] as const
          ).map((item) => {
            const isSelected = activePreset === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => selectPreset(item.key)}
                style={[
                  styles.presetChip,
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
                    styles.presetLabel,
                    {
                      color: isSelected ? colors.primary : colors.textMuted,
                      fontWeight: isSelected ? "700" : "500",
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom Date Range Inputs with DatePicker */}
        {activePreset === "custom" && (
          <Card style={styles.customDateCard}>
            <View style={styles.dateInputsRow}>
              <View style={styles.dateInputCol}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                  Start date
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    haptics.light();
                    setPickerTarget("start");
                  }}
                  style={[
                    styles.datePickerBtn,
                    { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
                  ]}
                >
                  <Calendar size={15} color={colors.primary} />
                  <Text style={[styles.datePickerBtnText, { color: colors.text }]}>
                    {startDate}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.dateInputCol}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                  End date
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    haptics.light();
                    setPickerTarget("end");
                  }}
                  style={[
                    styles.datePickerBtn,
                    { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
                  ]}
                >
                  <Calendar size={15} color={colors.primary} />
                  <Text style={[styles.datePickerBtnText, { color: colors.text }]}>
                    {endDate}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        )}

        {/* Auto Adjustment Notice Banner */}
        {dateNotice && (
          <View
            style={[
              styles.noticeBanner,
              { backgroundColor: colors.warningLight, borderColor: colors.warning },
            ]}
          >
            <AlertTriangle size={16} color={colors.warning} />
            <Text style={[styles.noticeText, { color: colors.warning }]}>
              {dateNotice}
            </Text>
          </View>
        )}

        {/* Inline Error Banner (Non-fatal, keeps controls fully interactive) */}
        {isError && (
          <Card
            style={[
              styles.errorCard,
              { backgroundColor: colors.dangerLight, borderColor: colors.danger },
            ]}
          >
            <View style={styles.errorHeader}>
              <AlertTriangle size={18} color={colors.danger} />
              <Text style={[styles.errorTitle, { color: colors.danger }]}>
                Failed to load revenue data
              </Text>
            </View>
            <Text style={[styles.errorMessage, { color: colors.text }]}>
              {(error as any)?.message ?? "An unexpected error occurred. Please try again."}
            </Text>
            <TouchableOpacity
              onPress={() => {
                void handleRefreshAll();
              }}
              style={[styles.retryBtn, { backgroundColor: colors.surface }]}
            >
              <RotateCw size={14} color={colors.danger} />
              <Text style={[styles.retryBtnText, { color: colors.danger }]}>
                Retry
              </Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Skeleton placeholder while loading */}
        {isLoading && !dashboard && <RevenueSkeleton />}

        {/* KPI Dashboard Cards */}
        {dashboard && (
          <>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiRow}>
                <StatCard
                  label="Revenue"
                  value={formatCurrency(dashboard.summary.revenueTotal)}
                  variant="primary"
                  icon={<DollarSign size={18} color={colors.primary} />}
                  style={styles.halfCard}
                />
                <StatCard
                  label="Cost of goods"
                  value={formatCurrency(dashboard.summary.cogsTotal)}
                  variant="danger"
                  icon={<Package size={18} color={colors.danger} />}
                  style={styles.halfCard}
                />
              </View>

              <View style={styles.kpiRow}>
                <StatCard
                  label="Profit"
                  value={formatCurrency(grossProfit)}
                  subtitle={`Margin: ${grossMarginPercent.toFixed(1)}%`}
                  variant="primary"
                  icon={<TrendingUp size={18} color={colors.primary} />}
                  style={styles.halfCard}
                />
                <StatCard
                  label="Expenses"
                  value={formatCurrency(expenseTotal)}
                  subtitle="Tap for breakdown"
                  variant="warning"
                  icon={<CreditCard size={18} color={colors.warning} />}
                  onPress={() => {
                    haptics.light();
                    setShowExpenseModal(true);
                  }}
                  style={styles.halfCard}
                />
              </View>

              <View style={styles.kpiRow}>
                <StatCard
                  label="Net profit"
                  value={formatCurrency(netProfit)}
                  subtitle={`Margin: ${marginPercent.toFixed(1)}%`}
                  variant={netProfit >= 0 ? "primary" : "danger"}
                  icon={<TrendingUp size={18} color={netProfit >= 0 ? colors.primary : colors.danger} />}
                  style={styles.halfCard}
                />
                <StatCard
                  label="Tax collected"
                  value={formatCurrency(dashboard.summary.taxTotal)}
                  variant="neutral"
                  icon={<Receipt size={18} color={colors.textMuted} />}
                  style={styles.halfCard}
                />
              </View>

              <View style={styles.kpiRow}>
                <StatCard
                  label="Total Sales"
                  value={`${dashboard.summary.saleCount}`}
                  subtitle="Completed orders"
                  variant="neutral"
                  icon={<ShoppingBag size={18} color={colors.accent} />}
                  style={styles.fullCard}
                />
              </View>
            </View>

            {/* Daily Trend List */}
            <View style={styles.sectionHeader}>
              <Calendar size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Daily Breakdown
              </Text>
            </View>

            {sortedTrend.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No sales recorded for this date range.
                </Text>
              </Card>
            ) : (
              sortedTrend.map((point) => {
                const dayExpenses = point.expenses ?? 0;
                const dayProfit =
                  point.netProfit ?? point.revenue - point.cogs - dayExpenses;
                return (
                  <Card key={point.date} style={styles.dayCard}>
                    <View style={styles.dayTopRow}>
                      <View style={styles.dayDateRow}>
                        <Calendar size={14} color={colors.textMuted} />
                        <Text style={[styles.dayDateText, { color: colors.text }]}>
                          {point.date}
                        </Text>
                      </View>
                      <Badge
                        variant={point.saleCount > 0 ? "primary" : "neutral"}
                        label={`${point.saleCount} sales`}
                      />
                    </View>

                    <View style={styles.dayMetricsGrid}>
                      <View style={styles.dayMetric}>
                        <Text style={[styles.dayMetricLabel, { color: colors.textMuted }]}>
                          Revenue
                        </Text>
                        <Text style={[styles.dayMetricVal, { color: colors.text }]}>
                          {formatCurrency(point.revenue)}
                        </Text>
                      </View>

                      <View style={styles.dayMetric}>
                        <Text style={[styles.dayMetricLabel, { color: colors.textMuted }]}>
                          COGS
                        </Text>
                        <Text style={[styles.dayMetricVal, { color: colors.textMuted }]}>
                          {formatCurrency(point.cogs)}
                        </Text>
                      </View>

                      <View style={styles.dayMetric}>
                        <Text style={[styles.dayMetricLabel, { color: colors.textMuted }]}>
                          Expenses
                        </Text>
                        <Text style={[styles.dayMetricVal, { color: colors.textMuted }]}>
                          {formatCurrency(dayExpenses)}
                        </Text>
                      </View>

                      <View style={styles.dayMetric}>
                        <Text style={[styles.dayMetricLabel, { color: colors.textMuted }]}>
                          Profit
                        </Text>
                        <Text
                          style={[
                            styles.dayMetricVal,
                            {
                              color:
                                dayProfit >= 0 ? colors.primary : colors.danger,
                              fontWeight: "700",
                            },
                          ]}
                        >
                          {formatCurrency(dayProfit)}
                        </Text>
                      </View>
                    </View>
                  </Card>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* DatePickerModal for custom date selection */}
      <DatePickerModal
        visible={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        value={pickerTarget === "start" ? startDate : endDate}
        title={pickerTarget === "start" ? "Select Start Date" : "Select End Date"}
        onSelectDate={(picked) => {
          if (pickerTarget === "start") {
            handleStartDateChange(picked);
          } else {
            handleEndDateChange(picked);
          }
          setPickerTarget(null);
        }}
      />

      {/* Expense Breakdown Modal */}
      <Modal
        visible={showExpenseModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowExpenseModal(false);
          setExpenseSearch("");
          setSelectedCategoryFilter("ALL");
        }}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surfaceCard }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Expense Breakdown
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                  {startDate === endDate ? `Today (${startDate})` : `${startDate} → ${endDate}`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  setShowExpenseModal(false);
                  setExpenseSearch("");
                  setSelectedCategoryFilter("ALL");
                }}
                style={[styles.modalCloseBtn, { backgroundColor: colors.surfaceRaised }]}
              >
                <X size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Total Summary Banner */}
            <View
              style={[
                styles.expSummaryBanner,
                { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
              ]}
            >
              <View>
                <Text style={[styles.expBannerLabel, { color: colors.textMuted }]}>
                  Total Incurred
                </Text>
                <Text style={[styles.expBannerAmount, { color: colors.warning }]}>
                  {formatCurrency(expenseTotal)}
                </Text>
              </View>
              <Badge variant="warning" label={`${expensesData?.content?.length ?? 0} items`} />
            </View>

            {/* Category Chips Scroll */}
            {expenseCategoriesSummary.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.expCatScroll}
                style={{ maxHeight: 42, marginVertical: 6 }}
              >
                <TouchableOpacity
                  onPress={() => setSelectedCategoryFilter("ALL")}
                  style={[
                    styles.expCatChip,
                    {
                      backgroundColor:
                        selectedCategoryFilter === "ALL" ? colors.primary : colors.surfaceRaised,
                      borderColor:
                        selectedCategoryFilter === "ALL" ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.expCatChipText,
                      { color: selectedCategoryFilter === "ALL" ? "#fff" : colors.text },
                    ]}
                  >
                    All ({expensesData?.content?.length ?? 0})
                  </Text>
                </TouchableOpacity>
                {expenseCategoriesSummary.map((cat) => {
                  const isSelected = selectedCategoryFilter === cat.category;
                  return (
                    <TouchableOpacity
                      key={cat.category}
                      onPress={() =>
                        setSelectedCategoryFilter(isSelected ? "ALL" : cat.category)
                      }
                      style={[
                        styles.expCatChip,
                        {
                          backgroundColor: isSelected ? colors.warning : colors.surfaceRaised,
                          borderColor: isSelected ? colors.warning : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.expCatChipText,
                          { color: isSelected ? "#fff" : colors.text },
                        ]}
                      >
                        {cat.category} • {formatCurrency(cat.total)} ({cat.percentage.toFixed(0)}%)
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Search Input */}
            <View style={{ paddingHorizontal: 16, marginVertical: 6 }}>
              <Input
                placeholder="Search description, staff, receipt..."
                value={expenseSearch}
                onChangeText={setExpenseSearch}
                containerStyle={{ marginBottom: 0 }}
              />
            </View>

            {/* Scrollable list of expenses */}
            <ScrollView
              style={styles.expList}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 }}
              showsVerticalScrollIndicator={true}
            >
              {filteredExpenses.length === 0 ? (
                <View style={styles.emptyExpContainer}>
                  <CreditCard size={32} color={colors.textMuted} style={{ marginBottom: 8 }} />
                  <Text style={[styles.emptyExpTitle, { color: colors.text }]}>
                    No expenses found
                  </Text>
                  <Text style={[styles.emptyExpDesc, { color: colors.textMuted }]}>
                    No expense records recorded for this filter period.
                  </Text>
                </View>
              ) : (
                filteredExpenses.map((exp) => (
                  <View
                    key={exp.id}
                    style={[
                      styles.expItemCard,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.expItemTop}>
                      <Badge variant="warning" label={exp.category || "General"} />
                      <Text style={[styles.expItemAmount, { color: colors.text }]}>
                        {formatCurrency(exp.amount)}
                      </Text>
                    </View>
                    <Text style={[styles.expItemDesc, { color: colors.text }]}>
                      {exp.description || "No description"}
                    </Text>
                    <View style={styles.expItemBottom}>
                      <Text style={[styles.expItemMeta, { color: colors.textMuted }]}>
                        {toLocalDateStr(exp.createdAt)}
                        {exp.incurredBy ? ` • By ${exp.incurredBy}` : ""}
                      </Text>
                      {exp.receiptRef ? (
                        <Text style={[styles.expItemMeta, { color: colors.textMuted }]}>
                          Ref: {exp.receiptRef}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  titleHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerRefreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  presetLabel: {
    fontSize: 12,
  },
  customDateCard: {
    padding: 12,
    marginBottom: 14,
  },
  dateInputsRow: {
    flexDirection: "row",
    gap: 10,
  },
  dateInputCol: {
    flex: 1,
  },
  datePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  datePickerBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  inputLabel: {
    fontSize: 11,
    marginBottom: 4,
    fontWeight: "500",
  },
  noticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginBottom: 14,
  },
  noticeText: {
    fontSize: 12,
    flex: 1,
    fontWeight: "600",
  },
  errorCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  errorMessage: {
    fontSize: 12,
    marginBottom: 10,
  },
  retryBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  loadingContainer: {
    padding: 36,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
  },
  kpiGrid: {
    gap: 12,
    marginBottom: 20,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 12,
  },
  halfCard: {
    flex: 1,
  },
  fullCard: {
    padding: 14,
  },
  salesStatRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  salesStatLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  salesStatLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  salesStatValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptyCard: {
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
  },
  dayCard: {
    padding: 12,
    marginBottom: 8,
  },
  dayTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  dayDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dayDateText: {
    fontSize: 13,
    fontWeight: "700",
  },
  dayMetricsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(150, 150, 150, 0.2)",
    paddingTop: 8,
  },
  dayMetric: {
    alignItems: "flex-start",
  },
  dayMetricLabel: {
    fontSize: 10,
    marginBottom: 2,
    fontWeight: "500",
  },
  dayMetricVal: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "88%",
    paddingTop: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  expSummaryBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  expBannerLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  expBannerAmount: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
  },
  expCatScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  expCatChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  expCatChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  expList: {
    maxHeight: 380,
  },
  emptyExpContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyExpTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  emptyExpDesc: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  expItemCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  expItemTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  expItemAmount: {
    fontSize: 14,
    fontWeight: "700",
  },
  expItemDesc: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  expItemBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  expItemMeta: {
    fontSize: 11,
  },
});
