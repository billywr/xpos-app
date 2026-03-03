package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.api.v1.admin.sales.dto.SaleSummaryResponse;
import com.blinc.xpos.common.constants.enums.SaleStatus;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import com.blinc.xpos.modules.sales.domain.Sale;
import com.blinc.xpos.modules.sales.service.ReceiptService;
import com.blinc.xpos.modules.sales.service.SaleService;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/operator/orgs/{orgId}/branches/{branchId}/receipts")
public class ReceiptsOperatorController {

  private final SaleService saleService;
  private final ReceiptService receiptService;
  private final BranchService branchService;
  private final StaffAuthorizationService staffAuthorizationService;
  private final CurrentPrincipalResolver principalResolver;
  private final PageRequestFactory pageRequestFactory;

  public ReceiptsOperatorController(
      SaleService saleService,
      ReceiptService receiptService,
      BranchService branchService,
      StaffAuthorizationService staffAuthorizationService,
      CurrentPrincipalResolver principalResolver,
      PageRequestFactory pageRequestFactory) {
    this.saleService = Objects.requireNonNull(saleService, "saleService");
    this.receiptService = Objects.requireNonNull(receiptService, "receiptService");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @GetMapping
  public Page<SaleSummaryResponse> list(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate fromDate,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate toDate,
      Pageable pageable) {
    staffAuthorizationService.requireStaffUser(
        orgId, principalResolver.require().iamUserId());
    var branch = branchService.require(orgId, branchId);
    ZoneId branchZone = toZoneId(branch.getTimezone());
    LocalDate todayInBranch = LocalDate.now(branchZone);
    LocalDate from = fromDate != null ? fromDate : todayInBranch;
    LocalDate to = toDate != null ? toDate : todayInBranch;
    Instant start = from.atStartOfDay(branchZone).toInstant();
    Instant end = to.plusDays(1).atStartOfDay(branchZone).toInstant();
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("completedAt").descending());
    return saleService
        .listByBranch(orgId, branchId, SaleStatus.COMPLETED, start, end, normalized)
        .map(ReceiptsOperatorController::toResponse);
  }

  @PostMapping("/{saleId}/refund")
  public SaleSummaryResponse refund(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID saleId) {
    var staffUser =
        staffAuthorizationService.requireStaffUser(
            orgId, principalResolver.require().iamUserId());
    branchService.require(orgId, branchId);
    Sale sale = saleService.refundSale(orgId, saleId, staffUser.getId());
    return toResponse(sale);
  }

  @PostMapping("/{saleId}/reprint")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void reprint(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID saleId) {
    staffAuthorizationService.requireStaffUser(
        orgId, principalResolver.require().iamUserId());
    branchService.require(orgId, branchId);
    receiptService.recordReprint(orgId, saleId);
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

  private static SaleSummaryResponse toResponse(Sale sale) {
    Long receiptNumber = sale.getReceipt() != null ? sale.getReceipt().getReceiptNumber() : null;
    String username =
        sale.getCreatedByStaffUser() != null ? sale.getCreatedByStaffUser().getUsername() : null;
    return new SaleSummaryResponse(
        sale.getId(),
        sale.getOrg().getId(),
        sale.getBranch().getId(),
        sale.getTerminal().getId(),
        receiptNumber,
        sale.getStatus().name(),
        sale.getTotal(),
        sale.getCreatedByStaffUser().getId(),
        username,
        sale.getCompletedAt(),
        sale.getCreatedAt());
  }
}
