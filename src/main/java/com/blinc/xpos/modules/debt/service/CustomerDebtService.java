package com.blinc.xpos.modules.debt.service;

import com.blinc.xpos.modules.debt.domain.CustomerDebt;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface CustomerDebtService {

  CustomerDebt create(
      UUID orgId,
      UUID branchId,
      UUID customerId,
      java.math.BigDecimal amount,
      java.time.LocalDate dueDate,
      String notes,
      UUID saleId,
      UUID terminalId,
      UUID shiftId,
      UUID createdByStaffUserId);

  CustomerDebt require(UUID orgId, UUID debtId);

  CustomerDebt update(
      UUID orgId,
      UUID debtId,
      java.math.BigDecimal amount,
      java.math.BigDecimal outstanding,
      java.time.LocalDate dueDate,
      String notes,
      UUID updatedByStaffUserId);

  CustomerDebt cancel(UUID orgId, UUID debtId, UUID cancelledByStaffUserId);

  CustomerDebt settle(
      UUID orgId,
      UUID debtId,
      java.math.BigDecimal paymentAmount,
      UUID settledByStaffUserId);

  Page<CustomerDebt> listByBranch(UUID orgId, UUID branchId, Pageable pageable);

  Page<CustomerDebt> listByCustomer(UUID orgId, UUID customerId, Pageable pageable);
}
