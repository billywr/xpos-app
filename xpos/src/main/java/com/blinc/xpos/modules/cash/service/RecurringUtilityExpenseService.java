package com.blinc.xpos.modules.cash.service;

import com.blinc.xpos.modules.cash.domain.RecurringUtilityApplyTiming;
import com.blinc.xpos.modules.cash.domain.RecurringUtilityExpense;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface RecurringUtilityExpenseService {

  RecurringUtilityExpense create(
      UUID orgId,
      UUID branchId,
      String name,
      BigDecimal amount,
      LocalDate effectiveFrom,
      LocalDate effectiveTo,
      RecurringUtilityApplyTiming applyTiming,
      Integer dueDayOfMonth,
      String payee,
      String accountNumber,
      String incurredBy,
      String notes,
      UUID createdByStaffUserId);

  RecurringUtilityExpense require(UUID orgId, UUID branchId, UUID utilityId);

  RecurringUtilityExpense update(
      UUID orgId,
      UUID branchId,
      UUID utilityId,
      String name,
      BigDecimal amount,
      LocalDate effectiveFrom,
      LocalDate effectiveTo,
      Boolean isRateChange,
      RecurringUtilityApplyTiming applyTiming,
      Integer dueDayOfMonth,
      String payee,
      String accountNumber,
      String incurredBy,
      Boolean active,
      String notes,
      UUID updatedByStaffUserId);

  void softDelete(UUID orgId, UUID branchId, UUID utilityId, UUID deletedByStaffUserId);

  Page<RecurringUtilityExpense> list(
      UUID orgId, UUID branchId, Boolean active, String query, Pageable pageable);

  List<RecurringUtilityExpense> listAllActive(UUID orgId, UUID branchId);

  List<RecurringUtilityExpense> listApplicableForPeriod(
      UUID orgId, UUID branchId, LocalDate startDate, LocalDate endDate);

  BigDecimal sumActiveMonthlyAmount(UUID orgId, UUID branchId);

  long countActive(UUID orgId, UUID branchId);
}
