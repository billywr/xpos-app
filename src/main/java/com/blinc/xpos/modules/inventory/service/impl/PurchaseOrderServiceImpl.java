package com.blinc.xpos.modules.inventory.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.catalog.service.ItemService;
import com.blinc.xpos.modules.catalog.service.UomService;
import com.blinc.xpos.modules.inventory.domain.PurchaseOrder;
import com.blinc.xpos.modules.inventory.domain.PurchaseOrderLine;
import com.blinc.xpos.modules.inventory.repository.PurchaseOrderLineRepository;
import com.blinc.xpos.modules.inventory.repository.PurchaseOrderRepository;
import com.blinc.xpos.modules.inventory.service.PurchaseOrderService;
import com.blinc.xpos.modules.inventory.service.SupplierService;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
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
public class PurchaseOrderServiceImpl implements PurchaseOrderService {

  private final PurchaseOrderRepository purchaseOrderRepository;
  private final PurchaseOrderLineRepository purchaseOrderLineRepository;
  private final BranchService branchService;
  private final SupplierService supplierService;
  private final StaffUserService staffUserService;
  private final ItemService itemService;
  private final UomService uomService;
  private final Clock clock;

  public PurchaseOrderServiceImpl(
      PurchaseOrderRepository purchaseOrderRepository,
      PurchaseOrderLineRepository purchaseOrderLineRepository,
      BranchService branchService,
      SupplierService supplierService,
      StaffUserService staffUserService,
      ItemService itemService,
      UomService uomService,
      Clock clock) {
    this.purchaseOrderRepository =
        Objects.requireNonNull(purchaseOrderRepository, "purchaseOrderRepository");
    this.purchaseOrderLineRepository =
        Objects.requireNonNull(purchaseOrderLineRepository, "purchaseOrderLineRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.supplierService = Objects.requireNonNull(supplierService, "supplierService");
    this.staffUserService = Objects.requireNonNull(staffUserService, "staffUserService");
    this.itemService = Objects.requireNonNull(itemService, "itemService");
    this.uomService = Objects.requireNonNull(uomService, "uomService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public PurchaseOrder create(
      UUID orgId, UUID branchId, UUID supplierId, UUID createdByStaffUserId) {
    Branch branch = branchService.require(orgId, branchId);
    var supplier = supplierService.require(orgId, supplierId);
    StaffUser staffUser = staffUserService.require(orgId, createdByStaffUserId);
    Instant now = Instant.now(clock);
    PurchaseOrder po = new PurchaseOrder();
    po.setOrg(branch.getOrg());
    po.setBranch(branch);
    po.setSupplier(supplier);
    po.setStatus(STATUS_DRAFT);
    po.setCreatedBy(staffUser);
    po.setCreatedAt(now);
    po.setUpdatedAt(now);
    return purchaseOrderRepository.save(po);
  }

  @Override
  @Transactional(readOnly = true)
  public PurchaseOrder require(UUID orgId, UUID purchaseOrderId) {
    return purchaseOrderRepository
        .findByIdAndOrgId(purchaseOrderId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "PURCHASE_ORDER_NOT_FOUND", "Purchase order not found: " + purchaseOrderId));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<PurchaseOrder> listByBranch(UUID orgId, UUID branchId, Pageable pageable) {
    branchService.require(orgId, branchId);
    return purchaseOrderRepository.findAllByOrgIdAndBranchId(orgId, branchId, pageable);
  }

  @Override
  @Transactional
  public PurchaseOrder addLine(
      UUID orgId,
      UUID purchaseOrderId,
      UUID itemId,
      BigDecimal qty,
      UUID uomId,
      BigDecimal expectedUnitCost) {
    PurchaseOrder po = require(orgId, purchaseOrderId);
    if (!STATUS_DRAFT.equals(po.getStatus())) {
      throw new IllegalStateException(
          "Only draft purchase orders can be modified. Current status: " + po.getStatus());
    }
    var item = itemService.requireActive(orgId, itemId);
    var uom = (uomId != null) ? uomService.require(orgId, uomId) : null;
    if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) {
      throw new IllegalArgumentException("Quantity must be positive");
    }
    Instant now = Instant.now(clock);
    PurchaseOrderLine line = new PurchaseOrderLine();
    line.setOrg(po.getOrg());
    line.setPurchaseOrder(po);
    line.setItem(item);
    line.setQty(qty);
    line.setUom(uom);
    line.setExpectedUnitCost(expectedUnitCost);
    line.setCreatedAt(now);
    purchaseOrderLineRepository.save(line);
    po.setUpdatedAt(now);
    return purchaseOrderRepository.save(po);
  }
}
