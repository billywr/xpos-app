package com.blinc.xpos.modules.reporting.service.impl;

import com.blinc.xpos.api.v1.operator.dto.AnalyticsSnapshotResponse;
import com.blinc.xpos.common.constants.enums.SaleStatus;
import com.blinc.xpos.modules.cash.domain.Shift;
import com.blinc.xpos.modules.cash.dto.ExpenseCategorySum;
import com.blinc.xpos.modules.cash.repository.MiscExpenseRepository;
import com.blinc.xpos.modules.cash.repository.ShiftRepository;
import com.blinc.xpos.modules.cash.service.ShiftExpectedCashService;
import com.blinc.xpos.modules.debt.repository.CustomerDebtRepository;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.reporting.service.OperatorAnalyticsService;
import com.blinc.xpos.modules.sales.domain.Sale;
import com.blinc.xpos.modules.sales.domain.Tender;
import com.blinc.xpos.modules.sales.dto.TopItemProjection;
import com.blinc.xpos.modules.sales.repository.SaleLineRepository;
import com.blinc.xpos.modules.sales.repository.SaleRepository;
import com.blinc.xpos.modules.sales.repository.TenderRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OperatorAnalyticsServiceImpl implements OperatorAnalyticsService {

  private static final int SCALE = 2;
  private static final RoundingMode ROUNDING = RoundingMode.HALF_UP;
  private static final int TOP_ITEMS_LIMIT = 10;

  private final BranchService branchService;
  private final SaleRepository saleRepository;
  private final SaleLineRepository saleLineRepository;
  private final TenderRepository tenderRepository;
  private final ShiftRepository shiftRepository;
  private final ShiftExpectedCashService shiftExpectedCashService;
  private final CustomerDebtRepository customerDebtRepository;
  private final MiscExpenseRepository miscExpenseRepository;

  public OperatorAnalyticsServiceImpl(
      BranchService branchService,
      SaleRepository saleRepository,
      SaleLineRepository saleLineRepository,
      TenderRepository tenderRepository,
      ShiftRepository shiftRepository,
      ShiftExpectedCashService shiftExpectedCashService,
      CustomerDebtRepository customerDebtRepository,
      MiscExpenseRepository miscExpenseRepository) {
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.saleRepository = Objects.requireNonNull(saleRepository, "saleRepository");
    this.saleLineRepository =
        Objects.requireNonNull(saleLineRepository, "saleLineRepository");
    this.tenderRepository = Objects.requireNonNull(tenderRepository, "tenderRepository");
    this.shiftRepository = Objects.requireNonNull(shiftRepository, "shiftRepository");
    this.shiftExpectedCashService =
        Objects.requireNonNull(shiftExpectedCashService, "shiftExpectedCashService");
    this.customerDebtRepository =
        Objects.requireNonNull(customerDebtRepository, "customerDebtRepository");
    this.miscExpenseRepository =
        Objects.requireNonNull(miscExpenseRepository, "miscExpenseRepository");
  }

  @Override
  @Transactional(readOnly = true)
  public AnalyticsSnapshotResponse getSnapshot(UUID orgId, UUID branchId) {
    Branch branch = branchService.require(orgId, branchId);
    ZoneId zone = toZoneId(branch.getTimezone());
    LocalDate today = LocalDate.now(zone);
    LocalDate yesterday = today.minusDays(1);

    Instant todayStart = today.atStartOfDay(zone).toInstant();
    Instant todayEnd = today.plusDays(1).atStartOfDay(zone).toInstant();
    Instant yesterdayStart = yesterday.atStartOfDay(zone).toInstant();
    Instant yesterdayEnd = todayStart;

    List<Sale> todaySales =
        saleRepository.findListByOrgIdAndBranchIdAndStatusAndCompletedAtBetween(
            orgId, branchId, SaleStatus.COMPLETED, todayStart, todayEnd);
    List<Sale> yesterdaySales =
        saleRepository.findListByOrgIdAndBranchIdAndStatusAndCompletedAtBetween(
            orgId, branchId, SaleStatus.COMPLETED, yesterdayStart, yesterdayEnd);

    BigDecimal todayRevenue =
        todaySales.stream()
            .map(Sale::getTotal)
            .filter(Objects::nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(SCALE, ROUNDING);
    BigDecimal todayTax =
        todaySales.stream()
            .map(Sale::getTaxTotal)
            .filter(Objects::nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(SCALE, ROUNDING);
    int todayCount = todaySales.size();
    BigDecimal todayAvg =
        todayCount > 0
            ? todayRevenue.divide(BigDecimal.valueOf(todayCount), SCALE, ROUNDING)
            : BigDecimal.ZERO;

    BigDecimal yesterdayRevenue =
        yesterdaySales.stream()
            .map(Sale::getTotal)
            .filter(Objects::nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

    BigDecimal percentChange = BigDecimal.ZERO;
    if (yesterdayRevenue.compareTo(BigDecimal.ZERO) > 0) {
      percentChange =
          todayRevenue
              .subtract(yesterdayRevenue)
              .divide(yesterdayRevenue, 4, RoundingMode.HALF_UP)
              .multiply(BigDecimal.valueOf(100))
              .setScale(1, ROUNDING);
    }

    AnalyticsSnapshotResponse.OpenShift openShift = buildOpenShift(orgId, branchId);
    List<AnalyticsSnapshotResponse.HourlyPoint> hourlyTrend =
        buildHourlyTrend(todaySales, zone);
    List<AnalyticsSnapshotResponse.TopItem> topItems =
        buildTopItems(orgId, branchId, todayStart, todayEnd);
    List<AnalyticsSnapshotResponse.PaymentBreakdown> paymentBreakdown =
        buildPaymentBreakdown(todaySales);
    List<AnalyticsSnapshotResponse.DailyTrendPoint> last7DaysTrend =
        buildLast7DaysTrend(orgId, branchId, zone);
    AnalyticsSnapshotResponse.DebtIntelligence debtIntelligence =
        buildDebtIntelligence(orgId, branchId, today);
    AnalyticsSnapshotResponse.ExpenseIntelligence expenseIntelligence =
        buildExpenseIntelligence(orgId, branchId, todayStart, todayEnd);

    return new AnalyticsSnapshotResponse(
        today,
        branch.getTimezone(),
        new AnalyticsSnapshotResponse.Summary(
            todayRevenue, todayCount, todayAvg, todayTax),
        openShift,
        hourlyTrend,
        topItems,
        paymentBreakdown,
        last7DaysTrend,
        new AnalyticsSnapshotResponse.Comparison(
            yesterdayRevenue.setScale(SCALE, ROUNDING), percentChange),
        debtIntelligence,
        expenseIntelligence,
        Instant.now());
  }

  private AnalyticsSnapshotResponse.DebtIntelligence buildDebtIntelligence(
      UUID orgId, UUID branchId, LocalDate today) {
    List<String> openStatusNames = Arrays.asList("OPEN", "PARTIAL");
    List<String> allActiveStatusNames = Arrays.asList("OPEN", "PARTIAL", "SETTLED");
    BigDecimal totalOriginal =
        customerDebtRepository.sumAmountByOrgIdAndBranchIdAndStatusIn(
            orgId, branchId, allActiveStatusNames);
    BigDecimal totalRepaid =
        customerDebtRepository.sumAmountSettledByOrgIdAndBranchIdAndStatusIn(
            orgId, branchId, allActiveStatusNames);
    BigDecimal totalOutstanding =
        customerDebtRepository.sumOutstandingByOrgIdAndBranchIdAndStatusIn(
            orgId, branchId, openStatusNames);
    BigDecimal overdue =
        customerDebtRepository.sumOverdueByOrgIdAndBranchIdAndStatusInAndDueDateBefore(
            orgId, branchId, openStatusNames, today);
    long openCount =
        customerDebtRepository.countByOrgIdAndBranchIdAndStatusIn(
            orgId, branchId, openStatusNames);
    List<String> settledOnly = List.of("SETTLED");
    long settledCount =
        customerDebtRepository.countByOrgIdAndBranchIdAndStatusIn(
            orgId, branchId, settledOnly);
    BigDecimal paymentRate = BigDecimal.ZERO;
    if (totalOriginal != null && totalOriginal.compareTo(BigDecimal.ZERO) > 0 && totalRepaid != null) {
      paymentRate =
          totalRepaid
              .multiply(BigDecimal.valueOf(100))
              .divide(totalOriginal, 4, RoundingMode.HALF_UP)
              .setScale(1, ROUNDING);
    }
    return new AnalyticsSnapshotResponse.DebtIntelligence(
        totalOriginal != null ? totalOriginal.setScale(SCALE, ROUNDING) : BigDecimal.ZERO,
        totalRepaid != null ? totalRepaid.setScale(SCALE, ROUNDING) : BigDecimal.ZERO,
        totalOutstanding != null ? totalOutstanding.setScale(SCALE, ROUNDING) : BigDecimal.ZERO,
        paymentRate,
        overdue != null ? overdue.setScale(SCALE, ROUNDING) : BigDecimal.ZERO,
        (int) openCount,
        (int) settledCount);
  }

  private AnalyticsSnapshotResponse.ExpenseIntelligence buildExpenseIntelligence(
      UUID orgId, UUID branchId, Instant todayStart, Instant todayEnd) {
    BigDecimal todayTotal =
        miscExpenseRepository.sumAmountByOrgIdAndBranchIdAndCreatedAtBetween(
            orgId, branchId, todayStart, todayEnd);
    List<ExpenseCategorySum> byCat =
        miscExpenseRepository.sumAmountByCategoryByOrgIdAndBranchIdAndCreatedAtBetween(
            orgId, branchId, todayStart, todayEnd);
    List<AnalyticsSnapshotResponse.ExpenseByCategory> categories =
        byCat.stream()
            .map(
                s ->
                    new AnalyticsSnapshotResponse.ExpenseByCategory(
                        s.getCategory() != null ? s.getCategory().name() : "OTHER",
                        s.getAmount() != null ? s.getAmount().setScale(SCALE, ROUNDING) : BigDecimal.ZERO))
            .toList();
    return new AnalyticsSnapshotResponse.ExpenseIntelligence(
        todayTotal != null ? todayTotal.setScale(SCALE, ROUNDING) : BigDecimal.ZERO,
        categories);
  }

  private AnalyticsSnapshotResponse.OpenShift buildOpenShift(
      UUID orgId, UUID branchId) {
    List<Shift> openShifts =
        shiftRepository.findByBranchIdAndStatus(
            branchId, com.blinc.xpos.common.constants.enums.ShiftStatus.OPEN);
    if (openShifts.isEmpty()) {
      return new AnalyticsSnapshotResponse.OpenShift(false, null, null);
    }
    BigDecimal totalExpected = BigDecimal.ZERO;
    Instant latestOpened = null;
    for (Shift shift : openShifts) {
      BigDecimal exp =
          shiftExpectedCashService.computeForOpenShift(orgId, shift.getId());
      if (exp != null) {
        totalExpected = totalExpected.add(exp);
      }
      if (latestOpened == null
          || (shift.getOpenedAt() != null
              && shift.getOpenedAt().isAfter(latestOpened))) {
        latestOpened = shift.getOpenedAt();
      }
    }
    return new AnalyticsSnapshotResponse.OpenShift(
        true,
        totalExpected.compareTo(BigDecimal.ZERO) > 0 ? totalExpected.setScale(SCALE, ROUNDING) : null,
        latestOpened);
  }

  private List<AnalyticsSnapshotResponse.HourlyPoint> buildHourlyTrend(
      List<Sale> sales, ZoneId zone) {
    Map<Integer, HourlyAgg> byHour = new TreeMap<>();
    for (int h = 0; h < 24; h++) {
      byHour.put(h, new HourlyAgg());
    }
    for (Sale s : sales) {
      if (s.getCompletedAt() == null) {
        continue;
      }
      int hour = s.getCompletedAt().atZone(zone).getHour();
      byHour
          .computeIfAbsent(hour, k -> new HourlyAgg())
          .add(s.getTotal(), 1);
    }
    return byHour.entrySet().stream()
        .map(
            e ->
                new AnalyticsSnapshotResponse.HourlyPoint(
                    e.getKey(),
                    e.getValue().revenue.setScale(SCALE, ROUNDING),
                    e.getValue().count))
        .toList();
  }

  private List<AnalyticsSnapshotResponse.TopItem> buildTopItems(
      UUID orgId, UUID branchId, Instant start, Instant end) {
    List<TopItemProjection> projections =
        saleLineRepository.findTopItemsByBranchAndDateRange(
            orgId, branchId, start, end, PageRequest.of(0, TOP_ITEMS_LIMIT));
    return projections.stream()
        .map(
            p ->
                new AnalyticsSnapshotResponse.TopItem(
                    p.itemId().toString(),
                    p.itemName() != null ? p.itemName() : "—",
                    p.totalQty() != null ? p.totalQty().setScale(SCALE, ROUNDING) : BigDecimal.ZERO,
                    p.totalRevenue() != null ? p.totalRevenue().setScale(SCALE, ROUNDING) : BigDecimal.ZERO))
        .toList();
  }

  private List<AnalyticsSnapshotResponse.DailyTrendPoint> buildLast7DaysTrend(
      UUID orgId, UUID branchId, ZoneId zone) {
    LocalDate end = LocalDate.now(zone);
    LocalDate start = end.minusDays(6);
    List<AnalyticsSnapshotResponse.DailyTrendPoint> result = new java.util.ArrayList<>();
    for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
      Instant dayStart = d.atStartOfDay(zone).toInstant();
      Instant dayEnd = d.plusDays(1).atStartOfDay(zone).toInstant();
      List<Sale> daySales =
          saleRepository.findListByOrgIdAndBranchIdAndStatusAndCompletedAtBetween(
              orgId, branchId, SaleStatus.COMPLETED, dayStart, dayEnd);
      BigDecimal rev =
          daySales.stream()
              .map(Sale::getTotal)
              .filter(Objects::nonNull)
              .reduce(BigDecimal.ZERO, BigDecimal::add)
              .setScale(SCALE, ROUNDING);
      result.add(
          new AnalyticsSnapshotResponse.DailyTrendPoint(d, rev, daySales.size()));
    }
    return result;
  }

  private List<AnalyticsSnapshotResponse.PaymentBreakdown> buildPaymentBreakdown(
      List<Sale> sales) {
    if (sales.isEmpty()) {
      return List.of();
    }
    List<UUID> saleIds = sales.stream().map(Sale::getId).toList();
    List<Tender> tenders = tenderRepository.findBySaleIdInWithTenderType(saleIds);
    Map<String, TenderAgg> byType = new HashMap<>();
    for (Tender t : tenders) {
      String code = t.getTenderType().getCode() != null
          ? t.getTenderType().getCode()
          : "OTHER";
      String name = t.getTenderType().getName() != null
          ? t.getTenderType().getName()
          : code;
      byType
          .computeIfAbsent(code, k -> new TenderAgg(name))
          .add(t.getAmount());
    }
    return byType.entrySet().stream()
        .map(
            e ->
                new AnalyticsSnapshotResponse.PaymentBreakdown(
                    e.getKey(),
                    e.getValue().name,
                    e.getValue().amount.setScale(SCALE, ROUNDING)))
        .toList();
  }

  private static ZoneId toZoneId(String timezone) {
    if (timezone == null || timezone.isBlank()) {
      return ZoneOffset.UTC;
    }
    try {
      return ZoneId.of(timezone.trim());
    } catch (Exception e) {
      return ZoneOffset.UTC;
    }
  }

  private static class HourlyAgg {
    BigDecimal revenue = BigDecimal.ZERO;
    int count = 0;

    void add(BigDecimal amt, int c) {
      revenue = revenue.add(amt != null ? amt : BigDecimal.ZERO);
      count += c;
    }
  }

  private static class TenderAgg {
    final String name;
    BigDecimal amount = BigDecimal.ZERO;

    TenderAgg(String name) {
      this.name = name;
    }

    void add(BigDecimal amt) {
      amount = amount.add(amt != null ? amt : BigDecimal.ZERO);
    }
  }
}
