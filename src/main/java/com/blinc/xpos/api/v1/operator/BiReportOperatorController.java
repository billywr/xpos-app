package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import com.blinc.xpos.modules.reporting.service.BiReportService;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Objects;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/operator/orgs/{orgId}/branches/{branchId}/reports")
public class BiReportOperatorController {

  private final BiReportService biReportService;
  private final StaffAuthorizationService staffAuthorizationService;
  private final BranchService branchService;
  private final CurrentPrincipalResolver principalResolver;

  public BiReportOperatorController(
      BiReportService biReportService,
      StaffAuthorizationService staffAuthorizationService,
      BranchService branchService,
      CurrentPrincipalResolver principalResolver) {
    this.biReportService = Objects.requireNonNull(biReportService, "biReportService");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
  }

  @GetMapping(value = "/bi-pdf", produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> downloadBiReport(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate fromDate,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate toDate) {
    staffAuthorizationService.requireStaffUser(orgId, principalResolver.require().iamUserId());
    Branch branch = branchService.require(orgId, branchId);
    ZoneId zone = toZoneId(branch.getTimezone());
    LocalDate today = LocalDate.now(zone);

    LocalDate from = fromDate != null ? fromDate : today.minusDays(6);
    LocalDate to = toDate != null ? toDate : today;
    if (to.isBefore(from)) {
      to = from;
    }

    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    biReportService.generateStakeholderReport(orgId, branchId, from, to, baos);

    String filename = "xpos-bi-report-" + from + "-to-" + to + ".pdf";
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
        .contentType(MediaType.APPLICATION_PDF)
        .body(baos.toByteArray());
  }

  private static ZoneId toZoneId(String timezone) {
    if (timezone == null || timezone.isBlank()) {
      return ZoneOffset.UTC;
    }
    try {
      return ZoneId.of(timezone.trim());
    } catch (Exception e) {
      return ZoneOffset.UTC;
    }
  }
}
