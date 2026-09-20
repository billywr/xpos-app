package com.blinc.xpos.modules.reporting.service.impl;

import com.blinc.xpos.common.constants.enums.SaleStatus;
import com.blinc.xpos.modules.cash.domain.MiscExpense;
import com.blinc.xpos.modules.cash.repository.MiscExpenseRepository;
import com.blinc.xpos.modules.inventory.domain.StockMovement;
import com.blinc.xpos.modules.inventory.repository.StockMovementRepository;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.reporting.dto.RevenueDashboardResponse;
import com.blinc.xpos.modules.reporting.dto.RevenueSummaryResponse;
import com.blinc.xpos.modules.reporting.dto.RevenueTrendPointResponse;
import com.blinc.xpos.modules.reporting.service.RevenueReportService;
import com.blinc.xpos.modules.sales.domain.Sale;
import com.blinc.xpos.modules.sales.repository.SaleRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RevenueReportServiceImpl implements RevenueReportService {

  private static final int SCALE = 2;
  private static final RoundingMode ROUNDING = RoundingMode.HALF_UP;

  private final SaleRepository saleRepository;
  private final StockMovementRepository stockMovementRepository;
  private final BranchService branchService;
  private final MiscExpenseRepository miscExpenseRepository;

  public RevenueReportServiceImpl(
      SaleRepository saleRepository,
      StockMovementRepository stockMovementRepository,
      BranchService branchService,
      MiscExpenseRepository miscExpenseRepository) {
    this.saleRepository = Objects.requireNonNull(saleRepository, "saleRepository");
    this.stockMovementRepository =
        Objects.requireNonNull(stockMovementRepository, "stockMovementRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.miscExpenseRepository =
        Objects.requireNonNull(miscExpenseRepository, "miscExpenseRepository");
  }

  @Override
  @Transactional(readOnly = true)
  public RevenueDashboardResponse getRevenueDashboard(
      UUID orgId, UUID branchId, LocalDate startDate, LocalDate endDate) {
    Branch branch = branchService.require(orgId, branchId);
    ZoneId zone = toZoneId(branch.getTimezone());

    Instant start = startDate.atStartOfDay(zone).toInstant();
    Instant end = endDate.plusDays(1).atStartOfDay(zone).toInstant();

    List<Sale> sales =
        saleRepository.findListByOrgIdAndBranchIdAndStatusAndCompletedAtBetween(
            orgId, branchId, SaleStatus.COMPLETED, start, end);

    List<StockMovement> saleMovements =
        stockMovementRepository.findSaleOutByBranchAndDateRange(orgId, branchId, start, end);

    List<MiscExpense> expenses =
        miscExpenseRepository.findListByOrgIdAndBranchIdAndCreatedAtBetween(
            orgId, branchId, start, end);

    BigDecimal revenueTotal = BigDecimal.ZERO;
    BigDecimal taxTotal = BigDecimal.ZERO;
    BigDecimal discountTotal = BigDecimal.ZERO;
    BigDecimal cogsTotal = BigDecimal.ZERO;
    BigDecimal expenseTotal = BigDecimal.ZERO;

    Map<LocalDate, DailyAggregate> byDate = new TreeMap<>();
    Map<LocalDate, BigDecimal> cogsByDate = new TreeMap<>();
    Map<LocalDate, BigDecimal> expensesByDate = new TreeMap<>();

    for (Sale s : sales) {
      LocalDate d = toLocalDate(s.getCompletedAt(), zone);
      revenueTotal = revenueTotal.add(s.getTotal());
      taxTotal = taxTotal.add(s.getTaxTotal());
      discountTotal = discountTotal.add(s.getDiscountTotal());

      byDate.computeIfAbsent(d, k -> new DailyAggregate()).add(s.getTotal(), s.getTaxTotal(), 1);
    }

    for (StockMovement m : saleMovements) {
      BigDecimal cost =
          m.getUnitCost() != null
              ? m.getQty().multiply(m.getUnitCost()).setScale(SCALE, ROUNDING)
              : BigDecimal.ZERO;
      cogsTotal = cogsTotal.add(cost);
      LocalDate d = toLocalDate(m.getCreatedAt(), zone);
      cogsByDate.merge(d, cost, BigDecimal::add);
    }

    for (MiscExpense exp : expenses) {
      BigDecimal amt = exp.getAmount() != null ? exp.getAmount() : BigDecimal.ZERO;
      expenseTotal = expenseTotal.add(amt);
      LocalDate d = toLocalDate(exp.getCreatedAt(), zone);
      expensesByDate.merge(d, amt, BigDecimal::add);
      byDate.computeIfAbsent(d, k -> new DailyAggregate());
    }

    BigDecimal netProfit = revenueTotal.subtract(cogsTotal).subtract(expenseTotal);

    RevenueSummaryResponse summary =
        new RevenueSummaryResponse(
            orgId,
            branchId,
            startDate,
            endDate,
            revenueTotal.setScale(SCALE, ROUNDING),
            taxTotal.setScale(SCALE, ROUNDING),
            discountTotal.setScale(SCALE, ROUNDING),
            cogsTotal.setScale(SCALE, ROUNDING),
            expenseTotal.setScale(SCALE, ROUNDING),
            netProfit.setScale(SCALE, ROUNDING),
            sales.size());

    List<RevenueTrendPointResponse> trend =
        byDate.entrySet().stream()
            .map(
                e -> {
                  BigDecimal dailyCogs = cogsByDate.getOrDefault(e.getKey(), BigDecimal.ZERO);
                  BigDecimal dailyExpenses =
                      expensesByDate.getOrDefault(e.getKey(), BigDecimal.ZERO);
                  BigDecimal dailyNetProfit =
                      e.getValue().revenue.subtract(dailyCogs).subtract(dailyExpenses);
                  return new RevenueTrendPointResponse(
                      e.getKey(),
                      e.getValue().revenue.setScale(SCALE, ROUNDING),
                      e.getValue().tax.setScale(SCALE, ROUNDING),
                      dailyCogs.setScale(SCALE, ROUNDING),
                      dailyExpenses.setScale(SCALE, ROUNDING),
                      dailyNetProfit.setScale(SCALE, ROUNDING),
                      e.getValue().saleCount);
                })
            .sorted(Comparator.comparing(RevenueTrendPointResponse::date))
            .toList();

    return new RevenueDashboardResponse(summary, trend);
  }

  private static LocalDate toLocalDate(Instant instant, ZoneId zone) {
    return instant.atZone(zone).toLocalDate();
  }

  private static ZoneId toZoneId(String timezone) {
    if (timezone == null || timezone.isBlank()) {
      return ZoneId.of("Africa/Nairobi");
    }
    try {
      return ZoneId.of(timezone.trim());
    } catch (Exception e) {
      return ZoneId.of("Africa/Nairobi");
    }
  }

  private static class DailyAggregate {
    BigDecimal revenue = BigDecimal.ZERO;
    BigDecimal tax = BigDecimal.ZERO;
    int saleCount = 0;

    void add(BigDecimal rev, BigDecimal t, int count) {
      revenue = revenue.add(rev);
      tax = tax.add(t);
      saleCount += count;
    }
  }
}
