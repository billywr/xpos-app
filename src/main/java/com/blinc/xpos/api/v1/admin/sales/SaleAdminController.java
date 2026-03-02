package com.blinc.xpos.api.v1.admin.sales;

import com.blinc.xpos.api.v1.admin.sales.dto.SaleSummaryResponse;
import com.blinc.xpos.common.constants.enums.SaleStatus;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.sales.domain.Sale;
import com.blinc.xpos.modules.sales.service.SaleService;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/branches/{branchId}/sales")
public class SaleAdminController {

  private final SaleService saleService;
  private final PageRequestFactory pageRequestFactory;

  public SaleAdminController(
      SaleService saleService, PageRequestFactory pageRequestFactory) {
    this.saleService = Objects.requireNonNull(saleService, "saleService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @GetMapping
  public Page<SaleSummaryResponse> list(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @RequestParam(defaultValue = "COMPLETED") SaleStatus status,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
      Pageable pageable) {
    Instant start =
        fromDate != null
            ? fromDate.atStartOfDay(ZoneOffset.UTC).toInstant()
            : LocalDate.EPOCH.atStartOfDay(ZoneOffset.UTC).toInstant();
    Instant end =
        toDate != null
            ? toDate.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant()
            : LocalDate.now(ZoneOffset.UTC).plusYears(10).atStartOfDay(ZoneOffset.UTC).toInstant();
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("completedAt").descending());
    return saleService.listByBranch(orgId, branchId, status, start, end, normalized)
        .map(SaleAdminController::toResponse);
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
