package com.blinc.xpos.api.v1.admin.ledger;

import com.blinc.xpos.api.v1.admin.ledger.dto.LedgerEntryResponse;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.ledger.domain.LedgerEntry;
import com.blinc.xpos.modules.ledger.service.LedgerEntryService;
import java.time.LocalDate;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/ledger-entries")
public class LedgerEntryAdminController {

  private final LedgerEntryService ledgerEntryService;
  private final PageRequestFactory pageRequestFactory;

  public LedgerEntryAdminController(
      LedgerEntryService ledgerEntryService,
      PageRequestFactory pageRequestFactory) {
    this.ledgerEntryService = Objects.requireNonNull(ledgerEntryService);
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory);
  }

  @GetMapping
  public Page<LedgerEntryResponse> list(
      @PathVariable UUID orgId,
      @RequestParam(required = false) UUID branchId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate businessDate,
      Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    if (branchId != null && businessDate != null) {
      return ledgerEntryService
          .listByBranchAndDate(orgId, branchId, businessDate, normalized)
          .map(LedgerEntryAdminController::toResponse);
    }
    if (branchId != null) {
      return ledgerEntryService
          .listByBranch(orgId, branchId, normalized)
          .map(LedgerEntryAdminController::toResponse);
    }
    return ledgerEntryService.list(orgId, normalized).map(LedgerEntryAdminController::toResponse);
  }

  @GetMapping("/{entryId}")
  public LedgerEntryResponse get(
      @PathVariable UUID orgId, @PathVariable UUID entryId) {
    return toResponse(ledgerEntryService.require(orgId, entryId));
  }

  private static LedgerEntryResponse toResponse(LedgerEntry e) {
    return new LedgerEntryResponse(
        e.getId(),
        e.getOrg().getId(),
        e.getBranch().getId(),
        e.getBusinessDate(),
        e.getSourceType(),
        e.getSourceId(),
        e.getAccount().getId(),
        e.getAccount().getCode(),
        e.getDirection(),
        e.getAmount(),
        e.getCurrency(),
        e.getCreatedAt());
  }
}
