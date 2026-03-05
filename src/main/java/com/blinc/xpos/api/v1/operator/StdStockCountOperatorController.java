package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.modules.inventory.dto.StdStockCountSaveRequest;
import com.blinc.xpos.modules.inventory.dto.StdStockCountSheetDto;
import com.blinc.xpos.modules.inventory.service.StdStockCountService;
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
 * Operator API for Standard Stock Count Sheet (bar-style). Opening + Added = Total; Units Sold =
 * Total − Closing; Amount = Units Sold × Selling Price.
 */
@RestController
@RequestMapping("/api/v1/operator/orgs/{orgId}/branches/{branchId}/std-stock-count")
public class StdStockCountOperatorController {

  private final StdStockCountService stdStockCountService;
  private final CurrentPrincipalResolver principalResolver;
  private final StaffAuthorizationService staffAuthorizationService;

  public StdStockCountOperatorController(
      StdStockCountService stdStockCountService,
      CurrentPrincipalResolver principalResolver,
      StaffAuthorizationService staffAuthorizationService) {
    this.stdStockCountService =
        Objects.requireNonNull(stdStockCountService, "stdStockCountService");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
  }

  @GetMapping
  public StdStockCountSheetDto getSheet(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @RequestParam LocalDate date) {
    staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    return stdStockCountService.getSheet(orgId, branchId, date);
  }

  @PutMapping
  public ResponseEntity<StdStockCountSheetDto> saveCounts(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @Valid @RequestBody StdStockCountSaveRequest request) {
    var staffUser = staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    StdStockCountSheetDto result =
        stdStockCountService.saveCounts(orgId, branchId, staffUser.getId(), request);
    return ResponseEntity.ok(result);
  }
}
