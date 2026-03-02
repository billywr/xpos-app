package com.blinc.xpos.api.v1.admin.cash;

import com.blinc.xpos.api.v1.operator.dto.CashMovementResponse;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.cash.domain.CashMovement;
import com.blinc.xpos.modules.cash.service.CashMovementService;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/branches/{branchId}/cash-movements")
public class CashMovementAdminController {

  private final CashMovementService cashMovementService;
  private final PageRequestFactory pageRequestFactory;

  public CashMovementAdminController(
      CashMovementService cashMovementService, PageRequestFactory pageRequestFactory) {
    this.cashMovementService =
        Objects.requireNonNull(cashMovementService, "cashMovementService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @GetMapping
  public Page<CashMovementResponse> list(
      @PathVariable("orgId") UUID orgId,
      @PathVariable("branchId") UUID branchId,
      Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    return cashMovementService.listByBranch(orgId, branchId, normalized)
        .map(CashMovementAdminController::toResponse);
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
