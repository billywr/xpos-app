package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.api.v1.operator.dto.ShiftCloseRequest;
import com.blinc.xpos.api.v1.operator.dto.ShiftOpenRequest;
import com.blinc.xpos.api.v1.operator.dto.ShiftResponse;
import com.blinc.xpos.common.security.CurrentPrincipal;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.modules.cash.domain.Shift;
import com.blinc.xpos.modules.cash.service.ShiftService;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/operator/orgs/{orgId}/branches/{branchId}/terminals/{terminalId}/shifts")
public class ShiftOperatorController {

  private final ShiftService shiftService;
  private final CurrentPrincipalResolver principalResolver;
  private final StaffAuthorizationService staffAuthorizationService;

  public ShiftOperatorController(
      ShiftService shiftService,
      CurrentPrincipalResolver principalResolver,
      StaffAuthorizationService staffAuthorizationService) {
    this.shiftService = Objects.requireNonNull(shiftService, "shiftService");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ShiftResponse openShift(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @Valid @RequestBody(required = false) ShiftOpenRequest request) {
    StaffUser staffUser = requireCurrentStaffUser(orgId, branchId);
    BigDecimal openingFloat =
        request != null && request.openingFloatAmount() != null
            ? request.openingFloatAmount()
            : BigDecimal.ZERO;
    Shift shift =
        shiftService.openShift(orgId, branchId, terminalId, staffUser.getId(), openingFloat);
    return toResponse(shift, orgId);
  }

  @GetMapping("/current")
  public ResponseEntity<ShiftResponse> getCurrentOpenShift(
      @PathVariable UUID orgId, @PathVariable UUID branchId, @PathVariable UUID terminalId) {
    Optional<Shift> shift = shiftService.getCurrentOpenShift(orgId, branchId, terminalId);
    return shift
        .map(s -> ResponseEntity.ok(toResponse(s, orgId)))
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  @PatchMapping("/{shiftId}")
  public ShiftResponse closeShift(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @PathVariable UUID shiftId,
      @Valid @RequestBody ShiftCloseRequest request) {
    Shift shift =
        shiftService.closeShift(
            orgId,
            shiftId,
            request.closingCountedAmount(),
            request.expectedCashAmount(),
            request.varianceAmount(),
            request.varianceReasonCodeId(),
            request.closedByManagerId());
    return toResponse(shift, orgId);
  }

  private StaffUser requireCurrentStaffUser(UUID orgId, UUID branchId) {
    CurrentPrincipal principal = principalResolver.require();
    return staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principal.iamUserId());
  }

  private ShiftResponse toResponse(Shift shift, UUID orgId) {
    BigDecimal expectedCash =
        "OPEN".equals(shift.getStatus().name())
            ? shiftService.computeExpectedCashForOpenShift(orgId, shift.getId())
            : shift.getExpectedCashAmount();
    return new ShiftResponse(
        shift.getId(),
        shift.getOrg().getId(),
        shift.getBranch().getId(),
        shift.getTerminal().getId(),
        shift.getStaffUser().getId(),
        shift.getOpenedAt(),
        shift.getClosedAt(),
        shift.getStatus().name(),
        shift.getOpeningFloatAmount(),
        shift.getClosingCountedAmount(),
        expectedCash,
        shift.getVarianceAmount(),
        shift.getClosedByManager() != null ? shift.getClosedByManager().getId() : null,
        shift.getVarianceReasonCode() != null ? shift.getVarianceReasonCode().getId() : null);
  }
}
