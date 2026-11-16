package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.api.v1.operator.dto.DayCloseRequest;
import com.blinc.xpos.api.v1.operator.dto.DayCloseResponse;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.modules.cash.domain.DayClose;
import com.blinc.xpos.modules.cash.service.DayCloseService;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import jakarta.validation.Valid;
import java.util.Objects;
import java.util.UUID;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/operator/orgs/{orgId}/branches/{branchId}/day-close")
public class DayCloseOperatorController {

  private final DayCloseService dayCloseService;
  private final CurrentPrincipalResolver principalResolver;
  private final StaffAuthorizationService staffAuthorizationService;

  public DayCloseOperatorController(
      DayCloseService dayCloseService,
      CurrentPrincipalResolver principalResolver,
      StaffAuthorizationService staffAuthorizationService) {
    this.dayCloseService = Objects.requireNonNull(dayCloseService, "dayCloseService");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
  }

  @PostMapping
  public DayCloseResponse closeDay(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @Valid @RequestBody DayCloseRequest request) {
    var staffUser =
        staffAuthorizationService.requireStaffUserForBranch(
            orgId, branchId, principalResolver.require().iamUserId());
    DayClose dayClose =
        dayCloseService.closeDay(orgId, branchId, request.businessDate(), staffUser.getId());
    return toResponse(dayClose);
  }

  private static DayCloseResponse toResponse(DayClose d) {
    return new DayCloseResponse(
        d.getId(),
        d.getOrg().getId(),
        d.getBranch().getId(),
        d.getBusinessDate(),
        d.getStatus().name(),
        d.getClosedBy() != null ? d.getClosedBy().getId() : null,
        d.getClosedAt(),
        d.getCreatedAt());
  }
}
