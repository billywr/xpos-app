package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.api.v1.operator.dto.SalesRecordingDraftRequest;
import com.blinc.xpos.api.v1.operator.dto.SalesRecordingDraftResponse;
import com.blinc.xpos.api.v1.operator.dto.SalesRecordingRequest;
import com.blinc.xpos.api.v1.operator.dto.SalesRecordingResponse;
import com.blinc.xpos.api.v1.operator.dto.SalesRecordingStatsResponse;
import com.blinc.xpos.common.security.CurrentPrincipal;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import com.blinc.xpos.modules.sales.service.SalesRecordingDraftService;
import com.blinc.xpos.modules.sales.service.SalesRecordingService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints for the Sales Recording screen: manual entry of current/backdated sales and dashboard
 * metrics for a business date. Accessible to any staff assigned to the org (operator or admin).
 */
@RestController
@RequestMapping(
    "/api/v1/operator/orgs/{orgId}/branches/{branchId}/terminals/{terminalId}/sales-recording")
public class SalesRecordingOperatorController {

  private final SalesRecordingService salesRecordingService;
  private final SalesRecordingDraftService salesRecordingDraftService;
  private final CurrentPrincipalResolver principalResolver;
  private final StaffAuthorizationService staffAuthorizationService;

  public SalesRecordingOperatorController(
      SalesRecordingService salesRecordingService,
      SalesRecordingDraftService salesRecordingDraftService,
      CurrentPrincipalResolver principalResolver,
      StaffAuthorizationService staffAuthorizationService) {
    this.salesRecordingService =
        Objects.requireNonNull(salesRecordingService, "salesRecordingService");
    this.salesRecordingDraftService =
        Objects.requireNonNull(salesRecordingDraftService, "salesRecordingDraftService");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public SalesRecordingResponse record(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @Valid @RequestBody SalesRecordingRequest request) {
    CurrentPrincipal principal = principalResolver.require();
    StaffUser staff = staffAuthorizationService.requireStaffUser(orgId, principal.iamUserId());
    SalesRecordingResponse response =
        salesRecordingService.recordBatch(
            orgId,
            branchId,
            terminalId,
            staff.getId(),
            request.saleDate(),
            request.entries().stream()
                .map(e -> new SalesRecordingService.Entry(e.itemId(), e.qty()))
                .toList());
    // The batch committed successfully — clear the persisted draft so it does not resurrect on
    // the next page load. Runs in its own transaction; failures here do not invalidate the sale.
    salesRecordingDraftService.deleteDraft(
        orgId, branchId, terminalId, principal.iamUserId(), request.saleDate());
    return response;
  }

  @GetMapping("/stats")
  public SalesRecordingStatsResponse stats(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
    requireStaff(orgId);
    return salesRecordingService.getStats(orgId, branchId, date);
  }

  @GetMapping("/draft")
  public SalesRecordingDraftResponse loadDraft(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
    CurrentPrincipal principal = principalResolver.require();
    staffAuthorizationService.requireStaffUser(orgId, principal.iamUserId());
    return salesRecordingDraftService.loadDraft(
        orgId, branchId, terminalId, principal.iamUserId(), date);
  }

  @PutMapping("/draft")
  public SalesRecordingDraftResponse saveDraft(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @Valid @RequestBody SalesRecordingDraftRequest request) {
    CurrentPrincipal principal = principalResolver.require();
    staffAuthorizationService.requireStaffUser(orgId, principal.iamUserId());
    return salesRecordingDraftService.saveDraft(
        orgId,
        branchId,
        terminalId,
        principal.iamUserId(),
        request.saleDate(),
        request.qtyByItem());
  }

  @DeleteMapping("/draft")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deleteDraft(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
    CurrentPrincipal principal = principalResolver.require();
    staffAuthorizationService.requireStaffUser(orgId, principal.iamUserId());
    salesRecordingDraftService.deleteDraft(
        orgId, branchId, terminalId, principal.iamUserId(), date);
  }

  private StaffUser requireStaff(UUID orgId) {
    return staffAuthorizationService.requireStaffUser(
        orgId, principalResolver.require().iamUserId());
  }
}
