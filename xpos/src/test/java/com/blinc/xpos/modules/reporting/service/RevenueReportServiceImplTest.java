package com.blinc.xpos.modules.reporting.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.blinc.xpos.modules.cash.domain.RecurringUtilityApplyTiming;
import com.blinc.xpos.modules.cash.domain.RecurringUtilityExpense;
import com.blinc.xpos.modules.cash.repository.MiscExpenseRepository;
import com.blinc.xpos.modules.cash.repository.RecurringUtilityExpenseRepository;
import com.blinc.xpos.modules.inventory.repository.StockMovementRepository;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.reporting.dto.RevenueDashboardResponse;
import com.blinc.xpos.modules.reporting.service.impl.RevenueReportServiceImpl;
import com.blinc.xpos.modules.sales.repository.SaleRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RevenueReportServiceImplTest {

  @Mock private SaleRepository saleRepository;
  @Mock private StockMovementRepository stockMovementRepository;
  @Mock private BranchService branchService;
  @Mock private MiscExpenseRepository miscExpenseRepository;
  @Mock private RecurringUtilityExpenseRepository recurringUtilityRepository;

  private RevenueReportServiceImpl service;

  private final UUID orgId = UUID.randomUUID();
  private final UUID branchId = UUID.randomUUID();
  private Branch branch;

  @BeforeEach
  void setUp() {
    service =
        new RevenueReportServiceImpl(
            saleRepository,
            stockMovementRepository,
            branchService,
            miscExpenseRepository,
            recurringUtilityRepository);

    branch = new Branch();
    branch.setId(branchId);
    branch.setTimezone("UTC");
    when(branchService.require(orgId, branchId)).thenReturn(branch);
  }

  @Test
  void endedUtilityAppliesForItsEffectivePeriod() {
    LocalDate start = LocalDate.of(2026, 10, 1);
    LocalDate end = LocalDate.of(2026, 10, 31);

    RecurringUtilityExpense endedUtil = new RecurringUtilityExpense();
    endedUtil.setName("Water Bill");
    endedUtil.setAmount(new BigDecimal("7000.00"));
    endedUtil.setEffectiveFrom(LocalDate.of(2026, 10, 1));
    endedUtil.setEffectiveTo(LocalDate.of(2026, 10, 31));
    endedUtil.setActive(false); // marked inactive when superseded
    endedUtil.setApplyTiming(RecurringUtilityApplyTiming.BEGINNING_OF_MONTH);

    when(recurringUtilityRepository.findApplicableForPeriod(orgId, branchId, start, end))
        .thenReturn(List.of(endedUtil));
    when(saleRepository.findListByOrgIdAndBranchIdAndStatusAndCompletedAtBetween(
            eq(orgId), eq(branchId), any(), any(), any()))
        .thenReturn(Collections.emptyList());
    when(stockMovementRepository.findSaleOutByBranchAndDateRange(
            eq(orgId), eq(branchId), any(), any()))
        .thenReturn(Collections.emptyList());
    when(miscExpenseRepository.findListByOrgIdAndBranchIdAndCreatedAtBetween(
            eq(orgId), eq(branchId), any(), any()))
        .thenReturn(Collections.emptyList());

    RevenueDashboardResponse response = service.getRevenueDashboard(orgId, branchId, start, end);

    assertEquals(new BigDecimal("7000.00"), response.summary().utilitiesTotal());
  }

  @Test
  void pausedUtilityWithoutEffectiveToDoesNotApply() {
    LocalDate start = LocalDate.of(2026, 11, 1);
    LocalDate end = LocalDate.of(2026, 11, 30);

    RecurringUtilityExpense pausedUtil = new RecurringUtilityExpense();
    pausedUtil.setName("Gym Membership");
    pausedUtil.setAmount(new BigDecimal("5000.00"));
    pausedUtil.setEffectiveFrom(LocalDate.of(2026, 1, 1));
    pausedUtil.setEffectiveTo(null);
    pausedUtil.setActive(false); // paused utility
    pausedUtil.setApplyTiming(RecurringUtilityApplyTiming.BEGINNING_OF_MONTH);

    when(recurringUtilityRepository.findApplicableForPeriod(orgId, branchId, start, end))
        .thenReturn(List.of(pausedUtil));
    when(saleRepository.findListByOrgIdAndBranchIdAndStatusAndCompletedAtBetween(
            eq(orgId), eq(branchId), any(), any(), any()))
        .thenReturn(Collections.emptyList());
    when(stockMovementRepository.findSaleOutByBranchAndDateRange(
            eq(orgId), eq(branchId), any(), any()))
        .thenReturn(Collections.emptyList());
    when(miscExpenseRepository.findListByOrgIdAndBranchIdAndCreatedAtBetween(
            eq(orgId), eq(branchId), any(), any()))
        .thenReturn(Collections.emptyList());

    RevenueDashboardResponse response = service.getRevenueDashboard(orgId, branchId, start, end);

    assertEquals(new BigDecimal("0.00"), response.summary().utilitiesTotal());
  }

  @Test
  void newRateAppliesOnlyFromEffectiveDate() {
    LocalDate start = LocalDate.of(2026, 11, 1);
    LocalDate end = LocalDate.of(2026, 11, 30);

    RecurringUtilityExpense newRateUtil = new RecurringUtilityExpense();
    newRateUtil.setName("Water Bill");
    newRateUtil.setAmount(new BigDecimal("6000.00"));
    newRateUtil.setEffectiveFrom(LocalDate.of(2026, 11, 1));
    newRateUtil.setEffectiveTo(null);
    newRateUtil.setActive(true);
    newRateUtil.setApplyTiming(RecurringUtilityApplyTiming.BEGINNING_OF_MONTH);

    when(recurringUtilityRepository.findApplicableForPeriod(orgId, branchId, start, end))
        .thenReturn(List.of(newRateUtil));
    when(saleRepository.findListByOrgIdAndBranchIdAndStatusAndCompletedAtBetween(
            eq(orgId), eq(branchId), any(), any(), any()))
        .thenReturn(Collections.emptyList());
    when(stockMovementRepository.findSaleOutByBranchAndDateRange(
            eq(orgId), eq(branchId), any(), any()))
        .thenReturn(Collections.emptyList());
    when(miscExpenseRepository.findListByOrgIdAndBranchIdAndCreatedAtBetween(
            eq(orgId), eq(branchId), any(), any()))
        .thenReturn(Collections.emptyList());

    RevenueDashboardResponse response = service.getRevenueDashboard(orgId, branchId, start, end);

    assertEquals(new BigDecimal("6000.00"), response.summary().utilitiesTotal());
  }
}
