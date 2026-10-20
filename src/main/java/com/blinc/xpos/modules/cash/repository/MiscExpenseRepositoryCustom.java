package com.blinc.xpos.modules.cash.repository;

import com.blinc.xpos.modules.cash.dto.ExpenseGroupSummaryProjection;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface MiscExpenseRepositoryCustom {

  /** Aggregate expenses grouped by category, incurredBy, or date (YYYY-MM-DD). */
  List<ExpenseGroupSummaryProjection> findGroupedExpenses(
      UUID orgId, UUID branchId, String groupBy, Instant from, Instant to);
}
