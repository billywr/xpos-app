package com.blinc.xpos.modules.reporting.service;

import java.io.OutputStream;
import java.time.LocalDate;
import java.util.UUID;

/** Generates Business Intelligence PDF reports for stakeholders. */
public interface BiReportService {

  /**
   * Generates a stakeholder BI report PDF for the given org, branch, and date range. Writes the PDF
   * to the provided output stream.
   */
  void generateStakeholderReport(
      UUID orgId, UUID branchId, LocalDate fromDate, LocalDate toDate, OutputStream out);
}
