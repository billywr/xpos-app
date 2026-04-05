package com.blinc.xpos.api.v1.admin.inventory;

import com.blinc.xpos.api.v1.admin.inventory.dto.StockCountLineAddRequest;
import com.blinc.xpos.api.v1.admin.inventory.dto.StockCountLineResponse;
import com.blinc.xpos.api.v1.admin.inventory.dto.StockCountLineUpdateRequest;
import com.blinc.xpos.api.v1.admin.inventory.dto.StockCountSessionResponse;
import com.blinc.xpos.api.v1.admin.inventory.dto.StockCountSessionStartRequest;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.inventory.domain.StockCountLine;
import com.blinc.xpos.modules.inventory.domain.StockCountSession;
import com.blinc.xpos.modules.inventory.repository.StockCountLineRepository;
import com.blinc.xpos.modules.inventory.repository.StockMovementRepository;
import com.blinc.xpos.modules.inventory.service.StockCountSessionService;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import com.blinc.xpos.modules.pricing.repository.PriceListItemRepository;
import com.blinc.xpos.modules.pricing.repository.PriceListRepository;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/stock-count-sessions")
public class StockCountSessionAdminController {

  private final StockCountSessionService sessionService;
  private final StockCountLineRepository lineRepository;
  private final StockMovementRepository stockMovementRepository;
  private final PriceListRepository priceListRepository;
  private final PriceListItemRepository priceListItemRepository;
  private final PageRequestFactory pageRequestFactory;
  private final CurrentPrincipalResolver principalResolver;
  private final StaffAuthorizationService staffAuthorizationService;

  public StockCountSessionAdminController(
      StockCountSessionService sessionService,
      StockCountLineRepository lineRepository,
      StockMovementRepository stockMovementRepository,
      PriceListRepository priceListRepository,
      PriceListItemRepository priceListItemRepository,
      PageRequestFactory pageRequestFactory,
      CurrentPrincipalResolver principalResolver,
      StaffAuthorizationService staffAuthorizationService) {
    this.sessionService = Objects.requireNonNull(sessionService, "sessionService");
    this.lineRepository = Objects.requireNonNull(lineRepository, "lineRepository");
    this.stockMovementRepository =
        Objects.requireNonNull(stockMovementRepository, "stockMovementRepository");
    this.priceListRepository = Objects.requireNonNull(priceListRepository, "priceListRepository");
    this.priceListItemRepository =
        Objects.requireNonNull(priceListItemRepository, "priceListItemRepository");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public StockCountSessionResponse start(
      @PathVariable UUID orgId, @Valid @RequestBody StockCountSessionStartRequest request) {
    var staffUser =
        staffAuthorizationService.requireStaffUser(orgId, principalResolver.require().iamUserId());
    StockCountSession session = sessionService.start(orgId, request.branchId(), staffUser.getId());
    return toResponse(session);
  }

  @GetMapping
  public Page<StockCountSessionResponse> listByBranch(
      @PathVariable UUID orgId, @RequestParam UUID branchId, Pageable pageable) {
    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("startedAt").descending());
    return sessionService.listByBranch(orgId, branchId, normalized).map(this::toResponse);
  }

  @GetMapping("/{sessionId}")
  public StockCountSessionResponse get(@PathVariable UUID orgId, @PathVariable UUID sessionId) {
    return toResponse(sessionService.require(orgId, sessionId));
  }

  @PostMapping("/{sessionId}/lines")
  public StockCountSessionResponse addLine(
      @PathVariable UUID orgId,
      @PathVariable UUID sessionId,
      @Valid @RequestBody StockCountLineAddRequest request) {
    StockCountSession session =
        sessionService.addLine(orgId, sessionId, request.itemId(), request.countedQty());
    return toResponse(session);
  }

  @PatchMapping("/{sessionId}/lines/{lineId}")
  public StockCountSessionResponse updateLine(
      @PathVariable UUID orgId,
      @PathVariable UUID sessionId,
      @PathVariable UUID lineId,
      @Valid @RequestBody StockCountLineUpdateRequest request) {
    StockCountSession session =
        sessionService.updateLine(orgId, sessionId, lineId, request.countedQty());
    return toResponse(session);
  }

  @DeleteMapping("/{sessionId}/lines/{lineId}")
  public StockCountSessionResponse deleteLine(
      @PathVariable UUID orgId, @PathVariable UUID sessionId, @PathVariable UUID lineId) {
    StockCountSession session = sessionService.deleteLine(orgId, sessionId, lineId);
    return toResponse(session);
  }

  @PostMapping("/{sessionId}/close")
  public StockCountSessionResponse close(@PathVariable UUID orgId, @PathVariable UUID sessionId) {
    var staffUser =
        staffAuthorizationService.requireStaffUser(orgId, principalResolver.require().iamUserId());
    return toResponse(sessionService.close(orgId, sessionId, staffUser.getId()));
  }

  @DeleteMapping("/{sessionId}")
  public StockCountSessionResponse softDelete(
      @PathVariable UUID orgId, @PathVariable UUID sessionId) {
    var staffUser =
        staffAuthorizationService.requireStaffUser(orgId, principalResolver.require().iamUserId());
    return toResponse(sessionService.softDelete(orgId, sessionId, staffUser.getId()));
  }

  private StockCountSessionResponse toResponse(StockCountSession s) {
    return toResponse(s, s.getOrg().getId());
  }

  private StockCountSessionResponse toResponse(StockCountSession s, UUID orgId) {
    List<StockCountLine> lines = lineRepository.findBySessionIdOrderByCreatedAt(s.getId());
    UUID branchId = s.getBranch().getId();
    List<StockCountLineResponse> lineResponses =
        lines.stream().map(l -> toLineResponse(l, s, orgId, branchId)).toList();
    return new StockCountSessionResponse(
        s.getId(),
        s.getOrg().getId(),
        s.getBranch().getId(),
        s.getStatus(),
        s.getSourceType(),
        s.getScheduleId(),
        s.getStartedBy().getId(),
        s.getStartedAt(),
        s.getClosedBy() != null ? s.getClosedBy().getId() : null,
        s.getClosedAt(),
        lineResponses);
  }

  private StockCountLineResponse toLineResponse(
      StockCountLine l, StockCountSession session, UUID orgId, UUID branchId) {
    BigDecimal unitCost = null;
    var latestIn =
        stockMovementRepository.findLatestInByOrgAndBranchAndItem(
            orgId, branchId, l.getItem().getId(), PageRequest.of(0, 1));
    if (!latestIn.isEmpty() && latestIn.getContent().get(0).getUnitCost() != null) {
      unitCost = latestIn.getContent().get(0).getUnitCost();
    }

    BigDecimal qtySold = BigDecimal.ZERO;
    var soldRows =
        stockMovementRepository.sumSoldQtyByItemIdForBranchSince(
            orgId, branchId, session.getStartedAt());
    for (Object[] row : soldRows) {
      if (l.getItem().getId().equals(row[0])) {
        qtySold = (BigDecimal) row[1];
        break;
      }
    }

    BigDecimal sellingPrice = null;
    var priceLists =
        priceListRepository.findActiveByOrgIdAndBranchIdOrderByPriorityDesc(orgId, branchId);
    for (var pl : priceLists) {
      var pli =
          priceListItemRepository.findByPriceListIdAndItemIdAndOrgId(
              pl.getId(), l.getItem().getId(), orgId);
      if (pli.isPresent() && pli.get().getPrice() != null) {
        sellingPrice = pli.get().getPrice();
        break;
      }
    }

    return new StockCountLineResponse(
        l.getId(),
        l.getSession().getId(),
        l.getItem().getId(),
        l.getItem().getName(),
        l.getCountedQty(),
        l.getSystemQty(),
        l.getVarianceQty(),
        unitCost,
        qtySold,
        sellingPrice,
        l.getCreatedAt());
  }
}
