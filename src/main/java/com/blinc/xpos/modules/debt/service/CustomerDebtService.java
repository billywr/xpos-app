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

  CustomerDebt update(UUID orgId, UUID debtId, DebtUpdateInput input, UUID updatedByStaffUserId);

  CustomerDebt cancel(UUID orgId, UUID debtId, UUID cancelledByStaffUserId);

  /**
   * Cancels all debts linked to a sale that have no repayments. Skips already cancelled/settled.
   * Throws if any linked debt has repayments (cannot auto-cancel).
   */
  void cancelDebtsForSale(UUID orgId, UUID saleId, UUID cancelledByStaffUserId);

  CustomerDebt settle(
      UUID orgId, UUID debtId, java.math.BigDecimal paymentAmount, UUID settledByStaffUserId);

  Page<CustomerDebt> listByBranch(UUID orgId, UUID branchId, Pageable pageable);

  /**
   * List debts by branch, optionally filtered by status. When statuses is null or empty, returns
   * all statuses.
   */
  Page<CustomerDebt> listByBranch(
      UUID orgId,
      UUID branchId,
      java.util.List<com.blinc.xpos.common.constants.enums.CustomerDebtStatus> statuses,
      Pageable pageable);

  Page<CustomerDebt> listByCustomer(UUID orgId, UUID customerId, Pageable pageable);

  /** Sum of outstanding (amount − settled) for OPEN and PARTIAL debts at this branch. */
  java.math.BigDecimal sumPendingOutstanding(UUID orgId, UUID branchId);
}
