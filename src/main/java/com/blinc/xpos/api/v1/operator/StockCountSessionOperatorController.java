package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.api.v1.admin.inventory.dto.StockCountLineAddRequest;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.api.v1.admin.inventory.dto.StockCountLineResponse;
import com.blinc.xpos.api.v1.admin.inventory.dto.StockCountSessionResponse;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.inventory.domain.StockCountLine;
import com.blinc.xpos.modules.inventory.domain.StockCountSession;
import com.blinc.xpos.modules.inventory.repository.StockCountLineRepository;
import com.blinc.xpos.modules.inventory.service.StockCountSessionService;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
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
  private final PageRequestFactory pageRequestFactory;
  private final CurrentPrincipalResolver principalResolver;
  private final StaffAuthorizationService staffAuthorizationService;

  public StockCountSessionOperatorController(
      StockCountSessionService sessionService,
      StockCountLineRepository lineRepository,
      PageRequestFactory pageRequestFactory,
      CurrentPrincipalResolver principalResolver,
      StaffAuthorizationService staffAuthorizationService) {
    this.sessionService = Objects.requireNonNull(sessionService, "sessionService");
    this.lineRepository = Objects.requireNonNull(lineRepository, "lineRepository");
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
    return toResponse(session);
  }

  @GetMapping
  public Page<StockCountSessionResponse> list(
      @PathVariable UUID orgId, @PathVariable UUID branchId, Pageable pageable) {
    staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("startedAt").descending());
    return sessionService.listByBranch(orgId, branchId, normalized).map(this::toResponse);
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
    return toResponse(session);
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
    return toResponse(session);
  }

  @PostMapping("/{sessionId}/close")
  public StockCountSessionResponse close(
      @PathVariable UUID orgId, @PathVariable UUID branchId, @PathVariable UUID sessionId) {
    var staffUser = staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    StockCountSession session = sessionService.require(orgId, sessionId);
    validateSessionBranch(session, branchId);
    return toResponse(sessionService.close(orgId, sessionId, staffUser.getId()));
  }

  private void validateSessionBranch(StockCountSession session, UUID branchId) {
    if (!session.getBranch().getId().equals(branchId)) {
      throw new NotFoundException(
          "STOCK_COUNT_SESSION_NOT_FOUND",
          "Stock count session not found in this branch.");
    }
  }

  private StockCountSessionResponse toResponse(StockCountSession s) {
    List<StockCountLine> lines = lineRepository.findBySessionIdOrderByCreatedAt(s.getId());
    List<StockCountLineResponse> lineResponses = lines.stream().map(this::toLineResponse).toList();
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

  private StockCountLineResponse toLineResponse(StockCountLine l) {
    return new StockCountLineResponse(
        l.getId(),
        l.getSession().getId(),
        l.getItem().getId(),
        l.getItem().getName(),
        l.getCountedQty(),
        l.getSystemQty(),
        l.getVarianceQty(),
        l.getCreatedAt());
  }
}
