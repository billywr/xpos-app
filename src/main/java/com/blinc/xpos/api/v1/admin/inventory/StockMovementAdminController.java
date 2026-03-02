package com.blinc.xpos.api.v1.admin.inventory;

import com.blinc.xpos.api.v1.admin.inventory.dto.StockMovementResponse;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.inventory.domain.StockMovement;
import com.blinc.xpos.modules.inventory.service.StockMovementService;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/stock-movements")
public class StockMovementAdminController {

  private final StockMovementService stockMovementService;
  private final PageRequestFactory pageRequestFactory;

  public StockMovementAdminController(
      StockMovementService stockMovementService,
      PageRequestFactory pageRequestFactory) {
    this.stockMovementService =
        Objects.requireNonNull(stockMovementService, "stockMovementService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @GetMapping
  public Page<StockMovementResponse> listByBranch(
      @PathVariable UUID orgId,
      @RequestParam UUID branchId,
      Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    return stockMovementService.listByBranch(orgId, branchId, normalized)
        .map(StockMovementAdminController::toResponse);
  }

  @GetMapping("/{stockMovementId}")
  public StockMovementResponse get(
      @PathVariable UUID orgId, @PathVariable UUID stockMovementId) {
    return toResponse(stockMovementService.require(orgId, stockMovementId));
  }

  private static StockMovementResponse toResponse(StockMovement s) {
    return new StockMovementResponse(
        s.getId(),
        s.getOrg().getId(),
        s.getBranch().getId(),
        s.getItem().getId(),
        s.getItem().getName(),
        s.getMovementType().name(),
        s.getQty(),
        s.getUom() != null ? s.getUom().getId() : null,
        s.getUnitCost(),
        s.getSourceType().name(),
        s.getSourceId(),
        s.getCreatedBy().getId(),
        s.getCreatedAt());
  }
}
