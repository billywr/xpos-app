package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.modules.inventory.dto.StdStockCountReconcilePreviewDto;
import com.blinc.xpos.modules.inventory.dto.StdStockCountReconcileRequest;
import com.blinc.xpos.modules.inventory.dto.StdStockCountReconcileResponse;
import com.blinc.xpos.modules.inventory.dto.StdStockCountRecordSalesRequest;
import com.blinc.xpos.modules.inventory.dto.StdStockCountRecordSalesResponse;
import com.blinc.xpos.modules.inventory.dto.StdStockCountSalesPreviewDto;
import com.blinc.xpos.modules.inventory.dto.StdStockCountSaveRequest;
import com.blinc.xpos.modules.inventory.dto.StdStockCountSheetDto;
import com.blinc.xpos.modules.inventory.service.StdStockCountService;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
      @PathVariable UUID orgId, @PathVariable UUID branchId, @RequestParam LocalDate date) {
    staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    return stdStockCountService.getSheet(orgId, branchId, date);
  }

  @PutMapping
  public ResponseEntity<StdStockCountSheetDto> saveCounts(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @Valid @RequestBody StdStockCountSaveRequest request) {
    var staffUser =
        staffAuthorizationService.requireStaffUserForBranch(
            orgId, branchId, principalResolver.require().iamUserId());
    StdStockCountSheetDto result =
        stdStockCountService.saveCounts(orgId, branchId, staffUser.getId(), request);
    return ResponseEntity.ok(result);
  }

  @GetMapping("/sales-preview")
  public StdStockCountSalesPreviewDto previewSales(
      @PathVariable UUID orgId, @PathVariable UUID branchId, @RequestParam LocalDate date) {
    staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    return stdStockCountService.previewSalesFromSheet(orgId, branchId, date);
  }

  @PostMapping("/record-sales")
  public ResponseEntity<StdStockCountRecordSalesResponse> recordSales(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @Valid @RequestBody StdStockCountRecordSalesRequest request) {
    var staffUser =
        staffAuthorizationService.requireStaffUserForBranch(
            orgId, branchId, principalResolver.require().iamUserId());
    StdStockCountRecordSalesResponse result =
        stdStockCountService.recordSalesFromSheet(
            orgId, branchId, request.terminalId(), staffUser.getId(), request.date());
    HttpStatus status =
        result.saleIds() != null && !result.saleIds().isEmpty()
            ? HttpStatus.CREATED
            : HttpStatus.OK;
    return ResponseEntity.status(status).body(result);
  }

  @GetMapping("/reconcile-preview")
  public StdStockCountReconcilePreviewDto previewReconcileInventory(
      @PathVariable UUID orgId, @PathVariable UUID branchId, @RequestParam LocalDate date) {
    staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    return stdStockCountService.previewReconcileInventory(orgId, branchId, date);
  }

  @PostMapping("/reconcile-inventory")
  public ResponseEntity<StdStockCountReconcileResponse> reconcileInventory(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @Valid @RequestBody StdStockCountReconcileRequest request) {
    var staffUser =
        staffAuthorizationService.requireStaffUserForBranch(
            orgId, branchId, principalResolver.require().iamUserId());
    StdStockCountReconcileResponse result =
        stdStockCountService.reconcileInventoryToClosing(
            orgId, branchId, staffUser.getId(), request.date());
    return ResponseEntity.ok(result);
  }
}
