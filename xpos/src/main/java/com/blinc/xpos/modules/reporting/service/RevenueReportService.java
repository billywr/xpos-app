package com.blinc.xpos.modules.reporting.service;

import com.blinc.xpos.modules.reporting.dto.RevenueDashboardResponse;
import java.time.LocalDate;
import java.util.UUID;

/** Service for revenue and P&amp;L reporting. Provides summary and trend data for dashboards. */
public interface RevenueReportService {

  /** Returns revenue dashboard for a branch over a date range: summary totals and daily trend. */
  RevenueDashboardResponse getRevenueDashboard(
      UUID orgId, UUID branchId, LocalDate startDate, LocalDate endDate);
}
