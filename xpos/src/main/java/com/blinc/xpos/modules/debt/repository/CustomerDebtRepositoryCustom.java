package com.blinc.xpos.modules.debt.repository;

import com.blinc.xpos.modules.debt.domain.CustomerDebt;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface CustomerDebtRepositoryCustom {

  /**
   * Find debts by org, branch and status filter. Uses native query for status (PostgreSQL enum)
   * then JPQL with join fetch for customer/createdBy to avoid LazyInitializationException.
   */
  Page<CustomerDebt> findAllByOrgIdAndBranchIdAndStatusIn(
      UUID orgId, UUID branchId, List<String> statusNames, Pageable pageable);

  /**
   * Find debts by org, branch, status filter and date range on createdAt. Uses native query for
   * status (PostgreSQL enum) then JPQL with join fetch.
   */
  Page<CustomerDebt> findAllByOrgIdAndBranchIdAndStatusInAndCreatedAtBetween(
      UUID orgId,
      UUID branchId,
      List<String> statusNames,
      Instant from,
      Instant to,
      Pageable pageable);

  /** Aggregate debts grouped by customer, issuedBy, status, or date (YYYY-MM-DD). */
  List<com.blinc.xpos.modules.debt.dto.DebtGroupSummaryProjection> findGroupedDebts(
      UUID orgId,
      UUID branchId,
      String groupBy,
      List<String> statusNames,
      Instant from,
      Instant to);
}
