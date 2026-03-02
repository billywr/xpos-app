package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.api.v1.operator.dto.CashMovementCreateRequest;
import com.blinc.xpos.api.v1.operator.dto.CashMovementResponse;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.modules.cash.domain.CashMovement;
import com.blinc.xpos.modules.cash.domain.Shift;
import com.blinc.xpos.modules.cash.service.CashMovementService;
import com.blinc.xpos.modules.cash.service.ShiftService;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/operator/orgs/{orgId}/branches/{branchId}/terminals/{terminalId}")
public class CashMovementOperatorController {

  private final CashMovementService cashMovementService;
  private final ShiftService shiftService;
  private final CurrentPrincipalResolver principalResolver;
  private final StaffAuthorizationService staffAuthorizationService;

  public CashMovementOperatorController(
      CashMovementService cashMovementService,
      ShiftService shiftService,
      CurrentPrincipalResolver principalResolver,
      StaffAuthorizationService staffAuthorizationService) {
    this.cashMovementService =
        Objects.requireNonNull(cashMovementService, "cashMovementService");
    this.shiftService = Objects.requireNonNull(shiftService, "shiftService");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
  }

  @PostMapping("/cash-movements")
  @ResponseStatus(HttpStatus.CREATED)
  public CashMovementResponse create(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @Valid @RequestBody CashMovementCreateRequest request) {
    var staffUser = staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    Shift current =
        shiftService
            .getCurrentOpenShift(orgId, branchId, terminalId)
            .orElseThrow(
                () ->
                    new IllegalStateException(
                        "No open shift for this terminal. Open a shift first."));
    CashMovement movement =
        cashMovementService.create(
            orgId,
            branchId,
            terminalId,
            current.getId(),
            request.type(),
            request.amount(),
            request.reasonCodeId(),
            staffUser.getId());
    return toResponse(movement);
  }

  @GetMapping("/shifts/{shiftId}/cash-movements")
  public List<CashMovementResponse> listByShift(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @PathVariable UUID shiftId) {
    return cashMovementService.listByShift(orgId, shiftId).stream()
        .map(CashMovementOperatorController::toResponse)
        .toList();
  }

  private static CashMovementResponse toResponse(CashMovement m) {
    return new CashMovementResponse(
        m.getId(),
        m.getShift().getId(),
        m.getType().name(),
        m.getAmount(),
        m.getReasonCode() != null ? m.getReasonCode().getId() : null,
        m.getCreatedBy().getId(),
        m.getCreatedAt());
  }
}
