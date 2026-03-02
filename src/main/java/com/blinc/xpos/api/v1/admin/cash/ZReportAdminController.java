package com.blinc.xpos.api.v1.admin.cash;

import com.blinc.xpos.modules.reporting.dto.ZReportSummaryResponse;
import com.blinc.xpos.modules.reporting.service.ZReportService;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/branches/{branchId}/z-report")
public class ZReportAdminController {

  private final ZReportService zReportService;

  public ZReportAdminController(ZReportService zReportService) {
    this.zReportService = Objects.requireNonNull(zReportService);
  }

  @GetMapping
  public ZReportSummaryResponse get(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate businessDate) {
    return zReportService.getZReport(orgId, branchId, businessDate);
  }
}
