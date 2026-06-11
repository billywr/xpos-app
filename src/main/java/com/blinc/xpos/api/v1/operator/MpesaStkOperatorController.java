package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.modules.mpesa.dto.MpesaStkInitiateRequest;
import com.blinc.xpos.modules.mpesa.dto.MpesaStkStatusResponse;
import com.blinc.xpos.modules.mpesa.service.MpesaStkService;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import jakarta.validation.Valid;
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
@RequestMapping(
    "/api/v1/operator/orgs/{orgId}/branches/{branchId}/terminals/{terminalId}/sales/{saleId}/mpesa")
public class MpesaStkOperatorController {

  private final MpesaStkService mpesaStkService;
  private final CurrentPrincipalResolver principalResolver;
  private final StaffAuthorizationService staffAuthorizationService;

  public MpesaStkOperatorController(
      MpesaStkService mpesaStkService,
      CurrentPrincipalResolver principalResolver,
      StaffAuthorizationService staffAuthorizationService) {
    this.mpesaStkService = Objects.requireNonNull(mpesaStkService);
    this.principalResolver = Objects.requireNonNull(principalResolver);
    this.staffAuthorizationService = Objects.requireNonNull(staffAuthorizationService);
  }

  @PostMapping("/stk")
  @ResponseStatus(HttpStatus.CREATED)
  public MpesaStkStatusResponse initiateStk(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @PathVariable UUID saleId,
      @Valid @RequestBody MpesaStkInitiateRequest request) {
    StaffUser staff =
        staffAuthorizationService.requireStaffUserForBranch(
            orgId, branchId, principalResolver.require().iamUserId());
    return mpesaStkService.initiateStk(orgId, branchId, terminalId, saleId, staff.getId(), request);
  }

  @GetMapping("/stk/{stkRequestId}")
  public MpesaStkStatusResponse getStkStatus(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @PathVariable UUID saleId,
      @PathVariable UUID stkRequestId) {
    staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    return mpesaStkService.getStatus(orgId, branchId, stkRequestId);
  }
}
