package com.blinc.xpos.api.v1.admin.reporting;

import com.blinc.xpos.modules.reporting.dto.RevenueDashboardResponse;
import com.blinc.xpos.modules.reporting.service.RevenueReportService;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/branches/{branchId}/revenue-dashboard")
public class RevenueDashboardAdminController {

  private final RevenueReportService revenueReportService;

  public RevenueDashboardAdminController(RevenueReportService revenueReportService) {
    this.revenueReportService =
        Objects.requireNonNull(revenueReportService, "revenueReportService");
  }

  @GetMapping
  public RevenueDashboardResponse get(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
      @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
    if (endDate.isBefore(startDate)) {
      throw new IllegalArgumentException("endDate must not be before startDate");
    }
    return revenueReportService.getRevenueDashboard(orgId, branchId, startDate, endDate);
  }
}
