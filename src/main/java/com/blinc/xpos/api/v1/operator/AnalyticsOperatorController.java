package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.api.v1.operator.dto.AnalyticsSnapshotResponse;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import com.blinc.xpos.modules.reporting.service.OperatorAnalyticsService;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/operator/orgs/{orgId}/branches/{branchId}/analytics")
public class AnalyticsOperatorController {

  private final OperatorAnalyticsService analyticsService;
  private final StaffAuthorizationService staffAuthorizationService;
  private final BranchService branchService;
  private final CurrentPrincipalResolver principalResolver;

  public AnalyticsOperatorController(
      OperatorAnalyticsService analyticsService,
      StaffAuthorizationService staffAuthorizationService,
      BranchService branchService,
      CurrentPrincipalResolver principalResolver) {
    this.analyticsService = Objects.requireNonNull(analyticsService, "analyticsService");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
  }

  @GetMapping("/snapshot")
  public AnalyticsSnapshotResponse getSnapshot(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate fromDate,
      @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate toDate) {
    staffAuthorizationService.requireStaffUser(orgId, principalResolver.require().iamUserId());
    branchService.require(orgId, branchId);
    return analyticsService.getSnapshot(orgId, branchId, fromDate, toDate);
  }
}
