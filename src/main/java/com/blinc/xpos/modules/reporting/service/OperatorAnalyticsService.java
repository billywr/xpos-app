package com.blinc.xpos.modules.reporting.service;

import com.blinc.xpos.api.v1.operator.dto.AnalyticsSnapshotResponse;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Real-time analytics for operator dashboard. Branch-scoped, uses branch timezone for business date
 * and hourly breakdown.
 */
public interface OperatorAnalyticsService {

  /**
   * Returns a live snapshot: revenue, sales count, open shift status, hourly trend, top items,
   * payment breakdown, and comparison. When fromDate and toDate are null, defaults to today in
   * branch timezone.
   */
  AnalyticsSnapshotResponse getSnapshot(
      UUID orgId, UUID branchId, LocalDate fromDate, LocalDate toDate);
}
