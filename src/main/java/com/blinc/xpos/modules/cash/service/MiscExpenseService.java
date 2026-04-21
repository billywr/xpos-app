package com.blinc.xpos.modules.cash.service;

import com.blinc.xpos.modules.cash.domain.MiscExpense;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface MiscExpenseService {

  MiscExpense create(
      UUID orgId,
      UUID branchId,
      BigDecimal amount,
      String category,
      String description,
      String incurredBy,
      String receiptRef,
      UUID terminalId,
      UUID shiftId,
      UUID createdByStaffUserId,
      Instant recordedAt);

  MiscExpense require(UUID orgId, UUID expenseId);

  MiscExpense update(
      UUID orgId,
      UUID expenseId,
      BigDecimal amount,
      String category,
      String description,
      String incurredBy,
      String receiptRef,
      UUID updatedByStaffUserId);

  MiscExpense softDelete(UUID orgId, UUID expenseId, UUID deletedByStaffUserId);

  BigDecimal sumAmountByBranch(UUID orgId, UUID branchId);

  BigDecimal sumAmountByBranch(UUID orgId, UUID branchId, Instant fromInstant, Instant toInstant);

  Page<MiscExpense> listByBranch(UUID orgId, UUID branchId, Pageable pageable);

  Page<MiscExpense> listByBranch(
      UUID orgId, UUID branchId, Instant fromInstant, Instant toInstant, Pageable pageable);

  /** Returns distinct category values used by this org, sorted alphabetically. */
  List<String> listCategoriesByOrg(UUID orgId);
}
