package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.modules.inventory.dto.ManualStockCountSaveRequest;
import com.blinc.xpos.modules.inventory.dto.ManualStockCountSheetResponse;
import com.blinc.xpos.modules.inventory.service.ManualStockCountService;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Operator API for manual bar-style stock sheet (no ledger). Opening carries from prior saved
 * closing; formulas match Standard Stock Count sheet.
 */
@RestController
@RequestMapping("/api/v1/operator/orgs/{orgId}/branches/{branchId}/manual-stock-count")
public class ManualStockCountOperatorController {

  private final ManualStockCountService manualStockCountService;
  private final CurrentPrincipalResolver principalResolver;
  private final StaffAuthorizationService staffAuthorizationService;

  public ManualStockCountOperatorController(
      ManualStockCountService manualStockCountService,
      CurrentPrincipalResolver principalResolver,
      StaffAuthorizationService staffAuthorizationService) {
    this.manualStockCountService =
        Objects.requireNonNull(manualStockCountService, "manualStockCountService");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
  }

  @GetMapping
  public ManualStockCountSheetResponse getSheet(
      @PathVariable UUID orgId, @PathVariable UUID branchId, @RequestParam LocalDate date) {
    staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    return manualStockCountService.getSheet(orgId, branchId, date);
  }

  @PutMapping
  public ResponseEntity<ManualStockCountSheetResponse> saveSheet(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @Valid @RequestBody ManualStockCountSaveRequest request) {
    var staffUser =
        staffAuthorizationService.requireStaffUserForBranch(
            orgId, branchId, principalResolver.require().iamUserId());
    ManualStockCountSheetResponse result =
        manualStockCountService.saveSheet(orgId, branchId, staffUser.getId(), request);
    return ResponseEntity.ok(result);
  }
}
