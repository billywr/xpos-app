package com.blinc.xpos.modules.reporting.service;

import com.blinc.xpos.modules.reporting.dto.ZReportSummaryResponse;
import java.time.LocalDate;
import java.util.UUID;

public interface ZReportService {

  /**
   * Builds Z-report summary for a branch and business date from completed sales and tenders.
   * Uses UTC day boundaries for the given business date.
   */
  ZReportSummaryResponse getZReport(UUID orgId, UUID branchId, LocalDate businessDate);
}
