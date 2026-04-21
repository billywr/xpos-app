package com.blinc.xpos.modules.sales.service;

import com.blinc.xpos.api.v1.operator.dto.SalesRecordingResponse;
import com.blinc.xpos.api.v1.operator.dto.SalesRecordingStatsResponse;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Records historical (or same-day) sales entered on the Sales Recording screen. Each entry becomes
 * its own Sale (COMPLETED) with exactly one line and an implicit CASH tender equal to the line
 * total. Unlike the live POS path, this flow:
 *
 * <ul>
 *   <li>does not require an open shift for the terminal
 *   <li>lets callers set the business date (up to 7 days in the past)
 *   <li>reuses inventory deduction + ledger posting so accounting and stock stay consistent
 * </ul>
 */
public interface SalesRecordingService {

  /**
   * Creates one Sale per entry on {@code saleDate} as a single atomic transaction. If any entry
   * fails validation (missing item, no selling price, insufficient stock, out-of-range date), the
   * whole batch is rolled back.
   */
  SalesRecordingResponse recordBatch(
      UUID orgId,
      UUID branchId,
      UUID terminalId,
      UUID staffUserId,
      LocalDate saleDate,
      List<Entry> entries);

  /** Dashboard metrics for a single business date (totals + top-sellers + low stock). */
  SalesRecordingStatsResponse getStats(UUID orgId, UUID branchId, LocalDate saleDate);

  /** A single row in a recording batch. */
  record Entry(UUID itemId, BigDecimal qty) {}
}
