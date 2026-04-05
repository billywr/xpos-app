package com.blinc.xpos.modules.debt.repository;

import com.blinc.xpos.modules.debt.domain.CustomerDebt;
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
}
