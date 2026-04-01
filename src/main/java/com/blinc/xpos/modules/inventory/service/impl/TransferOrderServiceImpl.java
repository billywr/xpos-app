package com.blinc.xpos.modules.inventory.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.catalog.service.ItemService;
import com.blinc.xpos.modules.catalog.service.UomService;
import com.blinc.xpos.modules.inventory.domain.TransferOrder;
import com.blinc.xpos.modules.inventory.domain.TransferOrderLine;
import com.blinc.xpos.modules.inventory.repository.TransferOrderLineRepository;
import com.blinc.xpos.modules.inventory.repository.TransferOrderRepository;
import com.blinc.xpos.modules.inventory.service.TransferOrderService;
import com.blinc.xpos.modules.organization.service.BranchService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TransferOrderServiceImpl implements TransferOrderService {

  private final TransferOrderRepository transferOrderRepository;
  private final TransferOrderLineRepository transferOrderLineRepository;
  private final BranchService branchService;
  private final ItemService itemService;
  private final UomService uomService;
  private final Clock clock;

  public TransferOrderServiceImpl(
      TransferOrderRepository transferOrderRepository,
      TransferOrderLineRepository transferOrderLineRepository,
      BranchService branchService,
      ItemService itemService,
      UomService uomService,
      Clock clock) {
    this.transferOrderRepository =
        Objects.requireNonNull(transferOrderRepository, "transferOrderRepository");
    this.transferOrderLineRepository =
        Objects.requireNonNull(transferOrderLineRepository, "transferOrderLineRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.itemService = Objects.requireNonNull(itemService, "itemService");
    this.uomService = Objects.requireNonNull(uomService, "uomService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public TransferOrder create(UUID orgId, UUID fromBranchId, UUID toBranchId) {
    var fromBranch = branchService.require(orgId, fromBranchId);
    var toBranch = branchService.require(orgId, toBranchId);
    if (fromBranchId.equals(toBranchId)) {
      throw new IllegalArgumentException("From and to branch must be different");
    }
    Instant now = Instant.now(clock);
    TransferOrder order = new TransferOrder();
    order.setOrg(fromBranch.getOrg());
    order.setFromBranch(fromBranch);
    order.setToBranch(toBranch);
    order.setStatus(STATUS_DRAFT);
    order.setCreatedAt(now);
    order.setUpdatedAt(now);
    return transferOrderRepository.save(order);
  }

  @Override
  @Transactional(readOnly = true)
  public TransferOrder require(UUID orgId, UUID transferOrderId) {
    return transferOrderRepository
        .findByIdAndOrgId(transferOrderId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "TRANSFER_ORDER_NOT_FOUND",
                    "Transfer order not found: " + transferOrderId));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<TransferOrder> list(UUID orgId, Pageable pageable) {
    return transferOrderRepository.findAllByOrgId(orgId, pageable);
  }

  @Override
  @Transactional
  public TransferOrder addLine(
      UUID orgId, UUID transferOrderId, UUID itemId, BigDecimal qty, UUID uomId) {
    TransferOrder order = require(orgId, transferOrderId);
    if (!STATUS_DRAFT.equals(order.getStatus())) {
      throw new IllegalStateException(
          "Only draft transfer orders can be modified. Status: " + order.getStatus());
    }
    var item = itemService.requireActive(orgId, itemId);
    var uom = (uomId != null) ? uomService.require(orgId, uomId) : null;
    if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) {
      throw new IllegalArgumentException("Quantity must be positive");
    }
    Instant now = Instant.now(clock);
    TransferOrderLine line = new TransferOrderLine();
    line.setOrg(order.getOrg());
    line.setTransferOrder(order);
    line.setItem(item);
    line.setQty(qty);
    line.setUom(uom);
    line.setCreatedAt(now);
    transferOrderLineRepository.save(line);
    order.setUpdatedAt(now);
    return transferOrderRepository.save(order);
  }
}
