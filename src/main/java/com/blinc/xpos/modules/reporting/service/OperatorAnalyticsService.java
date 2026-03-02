package com.blinc.xpos.modules.reporting.service;

import com.blinc.xpos.api.v1.operator.dto.AnalyticsSnapshotResponse;
import java.util.UUID;

/**
 * Real-time analytics for operator dashboard. Branch-scoped, uses branch timezone
 * for business date and hourly breakdown.
 */
public interface OperatorAnalyticsService {

  /**
   * Returns a live snapshot: today's revenue, sales count, open shift status,
   * hourly trend, top items, payment breakdown, and yesterday comparison.
   */
  AnalyticsSnapshotResponse getSnapshot(UUID orgId, UUID branchId);
}
