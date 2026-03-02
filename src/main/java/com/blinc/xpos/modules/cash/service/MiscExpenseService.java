package com.blinc.xpos.modules.cash.service;

import com.blinc.xpos.common.constants.enums.MiscExpenseCategory;
import com.blinc.xpos.modules.cash.domain.MiscExpense;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface MiscExpenseService {

  MiscExpense create(
      UUID orgId,
      UUID branchId,
      BigDecimal amount,
      MiscExpenseCategory category,
      String description,
      String incurredBy,
      String receiptRef,
      UUID terminalId,
      UUID shiftId,
      UUID createdByStaffUserId);

  MiscExpense require(UUID orgId, UUID expenseId);

  MiscExpense update(
      UUID orgId,
      UUID expenseId,
      BigDecimal amount,
      MiscExpenseCategory category,
      String description,
      String incurredBy,
      String receiptRef,
      UUID updatedByStaffUserId);

  MiscExpense softDelete(UUID orgId, UUID expenseId, UUID deletedByStaffUserId);

  java.math.BigDecimal sumAmountByBranch(UUID orgId, UUID branchId);

  Page<MiscExpense> listByBranch(UUID orgId, UUID branchId, Pageable pageable);
}
