package com.blinc.xpos.api.v1.operator.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Operator analytics snapshot: KPIs for the date range, hourly trend, top items, payment mix, 7-day
 * trend, debts and expenses intelligence. When fromDate and toDate are both set, they indicate the
 * filter range; when equal, a single day. businessDate equals fromDate for backward compatibility.
 */
public record AnalyticsSnapshotResponse(
    LocalDate businessDate,
    LocalDate fromDate,
    LocalDate toDate,
    String timezone,
    Summary summary,
    OpenShift openShift,
    List<HourlyPoint> hourlyTrend,
    List<TopItem> topItems,
    List<PaymentBreakdown> paymentBreakdown,
    List<DailyTrendPoint> last7DaysTrend,
    Comparison comparison,
    DebtIntelligence debtIntelligence,
    ExpenseIntelligence expenseIntelligence,
    Instant fetchedAt) {

  public record DebtIntelligence(
      BigDecimal totalOriginal,
      BigDecimal totalRepaid,
      BigDecimal totalOutstanding,
      BigDecimal paymentRatePercent,
      BigDecimal overdueAmount,
      int openDebtCount,
      int settledDebtCount) {}

  public record ExpenseIntelligence(BigDecimal todayTotal, List<ExpenseByCategory> byCategory) {}

  public record ExpenseByCategory(String category, BigDecimal amount) {}

  public record DailyTrendPoint(LocalDate date, BigDecimal revenue, int saleCount) {}

  public record Summary(
      BigDecimal todayRevenue,
      int todaySaleCount,
      BigDecimal todayAvgTicket,
      BigDecimal todayTaxTotal) {}

  public record OpenShift(
      boolean hasOpenShift, BigDecimal expectedCashInDrawer, Instant latestOpenedAt) {}

  public record HourlyPoint(int hour, BigDecimal revenue, int count) {}

  public record TopItem(
      String itemId, String itemName, BigDecimal totalQty, BigDecimal totalRevenue) {}

  public record PaymentBreakdown(String code, String name, BigDecimal amount) {}

  public record Comparison(BigDecimal previousPeriodRevenue, BigDecimal percentChange) {}
}
