package com.blinc.xpos.modules.inventory.service.impl;

import com.blinc.xpos.common.constants.enums.MovementType;
import com.blinc.xpos.common.constants.enums.SourceType;
import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.service.ItemService;
import com.blinc.xpos.modules.inventory.domain.StockCountLine;
import com.blinc.xpos.modules.inventory.domain.StockCountSession;
import com.blinc.xpos.modules.inventory.domain.StockMovement;
import com.blinc.xpos.modules.inventory.repository.InventoryItemRepository;
import com.blinc.xpos.modules.inventory.repository.StockCountLineRepository;
import com.blinc.xpos.modules.inventory.repository.StockCountSessionRepository;
import com.blinc.xpos.modules.inventory.repository.StockMovementRepository;
import com.blinc.xpos.modules.inventory.service.InventoryItemService;
import com.blinc.xpos.modules.inventory.service.StockCountSessionService;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StockCountSessionServiceImpl implements StockCountSessionService {

  private static final int SCALE = 3;

  private final StockCountSessionRepository sessionRepository;
  private final StockCountLineRepository lineRepository;
  private final InventoryItemRepository inventoryItemRepository;
  private final StockMovementRepository stockMovementRepository;
  private final InventoryItemService inventoryItemService;
  private final BranchService branchService;
  private final StaffUserService staffUserService;
  private final ItemService itemService;
  private final Clock clock;

  public StockCountSessionServiceImpl(
      StockCountSessionRepository sessionRepository,
      StockCountLineRepository lineRepository,
      InventoryItemRepository inventoryItemRepository,
      StockMovementRepository stockMovementRepository,
      InventoryItemService inventoryItemService,
      BranchService branchService,
      StaffUserService staffUserService,
      ItemService itemService,
      Clock clock) {
    this.sessionRepository = Objects.requireNonNull(sessionRepository, "sessionRepository");
    this.lineRepository = Objects.requireNonNull(lineRepository, "lineRepository");
    this.inventoryItemRepository =
        Objects.requireNonNull(inventoryItemRepository, "inventoryItemRepository");
    this.stockMovementRepository =
        Objects.requireNonNull(stockMovementRepository, "stockMovementRepository");
    this.inventoryItemService =
        Objects.requireNonNull(inventoryItemService, "inventoryItemService");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.staffUserService = Objects.requireNonNull(staffUserService, "staffUserService");
    this.itemService = Objects.requireNonNull(itemService, "itemService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public StockCountSession start(UUID orgId, UUID branchId, UUID startedByStaffUserId) {
    var branch = branchService.require(orgId, branchId);
    StaffUser staffUser = staffUserService.require(orgId, startedByStaffUserId);
    Instant now = Instant.now(clock);
    StockCountSession session = new StockCountSession();
    session.setOrg(branch.getOrg());
    session.setBranch(branch);
    session.setStatus(STATUS_OPEN);
    session.setSourceType(StockCountSession.SOURCE_MANUAL);
    session.setScheduleId(null);
    session.setStartedBy(staffUser);
    session.setStartedAt(now);
    return sessionRepository.save(session);
  }

  @Override
  @Transactional
  public StockCountSession startScheduled(
      UUID orgId, UUID branchId, UUID scheduleId, UUID startedByStaffUserId) {
    var branch = branchService.require(orgId, branchId);
    StaffUser staffUser = staffUserService.require(orgId, startedByStaffUserId);
    Instant now = Instant.now(clock);
    StockCountSession session = new StockCountSession();
    session.setOrg(branch.getOrg());
    session.setBranch(branch);
    session.setStatus(STATUS_OPEN);
    session.setSourceType(StockCountSession.SOURCE_SCHEDULED);
    session.setScheduleId(scheduleId);
    session.setStartedBy(staffUser);
    session.setStartedAt(now);
    return sessionRepository.save(session);
  }

  @Override
  @Transactional(readOnly = true)
  public StockCountSession require(UUID orgId, UUID sessionId) {
    return sessionRepository
        .findByIdAndOrgId(sessionId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "STOCK_COUNT_SESSION_NOT_FOUND",
                    "Stock count session not found: " + sessionId));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<StockCountSession> listByBranch(UUID orgId, UUID branchId, Pageable pageable) {
    branchService.require(orgId, branchId);
    return sessionRepository.findAllByOrgIdAndBranchId(orgId, branchId, pageable);
  }

  @Override
  @Transactional
  public StockCountSession addLine(
      UUID orgId, UUID sessionId, UUID itemId, BigDecimal countedQty) {
    StockCountSession session = require(orgId, sessionId);
    if (!STATUS_OPEN.equals(session.getStatus())) {
      throw new IllegalStateException(
          "Only open sessions can receive count lines. Status: " + session.getStatus());
    }
    var item = itemService.require(orgId, itemId);
    if (countedQty == null || countedQty.compareTo(BigDecimal.ZERO) < 0) {
      throw new IllegalArgumentException("Counted quantity must be non-negative");
    }
    BigDecimal systemQty = BigDecimal.ZERO;
    var invItem =
        inventoryItemRepository.findByOrgIdAndBranchIdAndItemId(
            orgId, session.getBranch().getId(), itemId);
    if (invItem.isPresent()) {
      systemQty = invItem.get().getOnHandQty();
    }
    BigDecimal varianceQty =
        countedQty.subtract(systemQty).setScale(SCALE, RoundingMode.HALF_UP);
    Instant now = Instant.now(clock);
    StockCountLine line = new StockCountLine();
    line.setOrg(session.getOrg());
    line.setSession(session);
    line.setItem(item);
    line.setCountedQty(countedQty.setScale(SCALE, RoundingMode.HALF_UP));
    line.setSystemQty(systemQty.setScale(SCALE, RoundingMode.HALF_UP));
    line.setVarianceQty(varianceQty);
    line.setCreatedAt(now);
    lineRepository.save(line);
    return session;
  }

  @Override
  @Transactional
  public StockCountSession updateLine(
      UUID orgId, UUID sessionId, UUID lineId, BigDecimal countedQty) {
    StockCountSession session = require(orgId, sessionId);
    if (!STATUS_OPEN.equals(session.getStatus())) {
      throw new IllegalStateException(
          "Only open sessions can be updated. Status: " + session.getStatus());
    }
    StockCountLine line =
        lineRepository
            .findByIdAndOrgId(lineId, orgId)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "STOCK_COUNT_LINE_NOT_FOUND",
                        "Stock count line not found: " + lineId));
    if (!line.getSession().getId().equals(sessionId)) {
      throw new IllegalArgumentException("Line does not belong to this session");
    }
    if (countedQty == null || countedQty.compareTo(BigDecimal.ZERO) < 0) {
      throw new IllegalArgumentException("Counted quantity must be non-negative");
    }
    BigDecimal varianceQty =
        countedQty
            .subtract(line.getSystemQty())
            .setScale(SCALE, RoundingMode.HALF_UP);
    line.setCountedQty(countedQty.setScale(SCALE, RoundingMode.HALF_UP));
    line.setVarianceQty(varianceQty);
    lineRepository.save(line);
    return session;
  }

  @Override
  @Transactional
  public StockCountSession deleteLine(UUID orgId, UUID sessionId, UUID lineId) {
    StockCountSession session = require(orgId, sessionId);
    if (!STATUS_OPEN.equals(session.getStatus())) {
      throw new IllegalStateException(
          "Only open sessions can have lines deleted. Status: " + session.getStatus());
    }
    StockCountLine line =
        lineRepository
            .findByIdAndOrgId(lineId, orgId)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "STOCK_COUNT_LINE_NOT_FOUND",
                        "Stock count line not found: " + lineId));
    if (!line.getSession().getId().equals(sessionId)) {
      throw new IllegalArgumentException("Line does not belong to this session");
    }
    lineRepository.delete(line);
    return session;
  }

  @Override
  @Transactional
  public StockCountSession close(UUID orgId, UUID sessionId, UUID closedByStaffUserId) {
    StockCountSession session = require(orgId, sessionId);
    if (!STATUS_OPEN.equals(session.getStatus())) {
      throw new IllegalStateException(
          "Session is not open. Status: " + session.getStatus());
    }
    StaffUser closedBy = staffUserService.require(orgId, closedByStaffUserId);
    session.setClosedBy(closedBy);
    session.setStatus(STATUS_CLOSED);
    Instant now = Instant.now(clock);
    session.setClosedAt(now);

    List<StockCountLine> lines = lineRepository.findBySessionIdOrderByCreatedAt(sessionId);
    UUID branchId = session.getBranch().getId();
    Map<UUID, BigDecimal> countedByItem = new java.util.HashMap<>();
    for (StockCountLine line : lines) {
      UUID itemId = line.getItem().getId();
      BigDecimal qty = line.getCountedQty();
      if (qty != null) {
        countedByItem.merge(itemId, qty.setScale(SCALE, RoundingMode.HALF_UP), BigDecimal::add);
      }
    }
    for (var e : countedByItem.entrySet()) {
      UUID itemId = e.getKey();
      BigDecimal totalCounted = e.getValue();
      BigDecimal systemQty = BigDecimal.ZERO;
      var invItem =
          inventoryItemRepository.findByOrgIdAndBranchIdAndItemId(orgId, branchId, itemId);
      if (invItem.isPresent()) {
        systemQty = invItem.get().getOnHandQty().setScale(SCALE, RoundingMode.HALF_UP);
      }
      BigDecimal variance =
          totalCounted.subtract(systemQty).setScale(SCALE, RoundingMode.HALF_UP);
      if (variance.compareTo(BigDecimal.ZERO) == 0) {
        continue;
      }
      Item item = itemService.require(orgId, itemId);
      StockMovement mov = new StockMovement();
      mov.setOrg(session.getOrg());
      mov.setBranch(session.getBranch());
      mov.setItem(item);
      mov.setMovementType(MovementType.ADJUST);
      mov.setQty(variance);
      mov.setSourceType(SourceType.STOCKTAKE);
      mov.setSourceId(sessionId);
      mov.setCreatedBy(closedBy);
      mov.setCreatedAt(now);
      stockMovementRepository.save(mov);
      inventoryItemService.applyStockTakeVariance(orgId, branchId, itemId, variance);
    }
    return sessionRepository.save(session);
  }

  @Override
  @Transactional
  public StockCountSession softDelete(
      UUID orgId, UUID sessionId, UUID deletedByStaffUserId) {
    StockCountSession session = require(orgId, sessionId);
    if (session.getDeletedAt() != null) {
      throw new BadRequestException(
          "SESSION_ALREADY_DELETED", "Session is already deleted.");
    }
    StaffUser deletedBy = staffUserService.require(orgId, deletedByStaffUserId);
    session.setDeletedAt(Instant.now(clock));
    session.setDeletedBy(deletedBy);
    return sessionRepository.save(session);
  }
}
