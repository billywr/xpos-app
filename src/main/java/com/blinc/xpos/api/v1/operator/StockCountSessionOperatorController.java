package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.api.v1.admin.inventory.dto.StockCountLineAddRequest;
import com.blinc.xpos.api.v1.admin.inventory.dto.StockCountLineResponse;
import com.blinc.xpos.api.v1.admin.inventory.dto.StockCountLineUpdateRequest;
import com.blinc.xpos.api.v1.admin.inventory.dto.StockCountSessionResponse;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.inventory.domain.StockCountLine;
import com.blinc.xpos.modules.inventory.domain.StockCountSession;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.inventory.repository.StockCountLineRepository;
import com.blinc.xpos.modules.inventory.repository.StockMovementRepository;
import com.blinc.xpos.modules.pricing.repository.PriceListItemRepository;
import com.blinc.xpos.modules.pricing.repository.PriceListRepository;
import com.blinc.xpos.modules.inventory.service.StockCountSessionService;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Operator API for manual stock taking. Branch-scoped; staff must be assigned to the branch.
 * Industry standard: floor staff perform cycle counts at their branch.
 */
@RestController
@RequestMapping("/api/v1/operator/orgs/{orgId}/branches/{branchId}/stock-count-sessions")
public class StockCountSessionOperatorController {

  private final StockCountSessionService sessionService;
  private final StockCountLineRepository lineRepository;
  private final StockMovementRepository stockMovementRepository;
  private final PriceListRepository priceListRepository;
  private final PriceListItemRepository priceListItemRepository;
  private final PageRequestFactory pageRequestFactory;
  private final CurrentPrincipalResolver principalResolver;
  private final StaffAuthorizationService staffAuthorizationService;

  public StockCountSessionOperatorController(
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
    this.priceListRepository =
        Objects.requireNonNull(priceListRepository, "priceListRepository");
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
      @PathVariable UUID orgId, @PathVariable UUID branchId) {
    var staffUser = staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    StockCountSession session = sessionService.start(orgId, branchId, staffUser.getId());
    return toResponse(session, orgId, branchId);
  }

  @GetMapping
  public Page<StockCountSessionResponse> list(
      @PathVariable UUID orgId, @PathVariable UUID branchId, Pageable pageable) {
    staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("startedAt").descending());
    return sessionService
        .listByBranch(orgId, branchId, normalized)
        .map(s -> toResponse(s, orgId, branchId));
  }

  @GetMapping("/{sessionId}")
  public StockCountSessionResponse get(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID sessionId) {
    staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    StockCountSession session = sessionService.require(orgId, sessionId);
    validateSessionBranch(session, branchId);
    return toResponse(session, orgId, branchId);
  }

  @PostMapping("/{sessionId}/lines")
  public StockCountSessionResponse addLine(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID sessionId,
      @Valid @RequestBody StockCountLineAddRequest request) {
    staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    StockCountSession session =
        sessionService.addLine(orgId, sessionId, request.itemId(), request.countedQty());
    validateSessionBranch(session, branchId);
    return toResponse(session, orgId, branchId);
  }

  @PatchMapping("/{sessionId}/lines/{lineId}")
  public StockCountSessionResponse updateLine(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID sessionId,
      @PathVariable UUID lineId,
      @Valid @RequestBody StockCountLineUpdateRequest request) {
    staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    StockCountSession session =
        sessionService.updateLine(orgId, sessionId, lineId, request.countedQty());
    validateSessionBranch(session, branchId);
    return toResponse(session, orgId, branchId);
  }

  @DeleteMapping("/{sessionId}/lines/{lineId}")
  public StockCountSessionResponse deleteLine(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID sessionId,
      @PathVariable UUID lineId) {
    staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    StockCountSession session = sessionService.deleteLine(orgId, sessionId, lineId);
    validateSessionBranch(session, branchId);
    return toResponse(session, orgId, branchId);
  }

  @PostMapping("/{sessionId}/close")
  public StockCountSessionResponse close(
      @PathVariable UUID orgId, @PathVariable UUID branchId, @PathVariable UUID sessionId) {
    var staffUser = staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    StockCountSession session = sessionService.require(orgId, sessionId);
    validateSessionBranch(session, branchId);
    return toResponse(
        sessionService.close(orgId, sessionId, staffUser.getId()), orgId, branchId);
  }

  @DeleteMapping("/{sessionId}")
  public StockCountSessionResponse softDelete(
      @PathVariable UUID orgId, @PathVariable UUID branchId, @PathVariable UUID sessionId) {
    var staffUser = staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    StockCountSession session = sessionService.require(orgId, sessionId);
    validateSessionBranch(session, branchId);
    return toResponse(
        sessionService.softDelete(orgId, sessionId, staffUser.getId()), orgId, branchId);
  }

  private void validateSessionBranch(StockCountSession session, UUID branchId) {
    if (!session.getBranch().getId().equals(branchId)) {
      throw new NotFoundException(
          "STOCK_COUNT_SESSION_NOT_FOUND",
          "Stock count session not found in this branch.");
    }
  }

  private StockCountSessionResponse toResponse(
      StockCountSession s, UUID orgId, UUID branchId) {
    List<StockCountLine> lines = lineRepository.findBySessionIdOrderByCreatedAt(s.getId());
    List<StockCountLineResponse> lineResponses =
        lines.stream()
            .map(l -> toLineResponse(l, s, orgId, branchId))
            .toList();
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
