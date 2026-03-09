package com.blinc.xpos.modules.inventory.service.impl;

import com.blinc.xpos.common.constants.enums.MovementType;
import com.blinc.xpos.common.constants.enums.SourceType;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.catalog.service.ItemService;
import com.blinc.xpos.modules.catalog.service.UomService;
import com.blinc.xpos.modules.inventory.domain.GoodsReceiptNote;
import com.blinc.xpos.modules.inventory.domain.GrnLine;
import com.blinc.xpos.modules.inventory.domain.StockMovement;
import com.blinc.xpos.modules.inventory.repository.GoodsReceiptNoteRepository;
import com.blinc.xpos.modules.inventory.repository.GrnLineRepository;
import com.blinc.xpos.modules.inventory.repository.StockMovementRepository;
import com.blinc.xpos.modules.inventory.service.GoodsReceiptNoteService;
import com.blinc.xpos.modules.inventory.service.InventoryItemService;
import com.blinc.xpos.modules.inventory.service.PurchaseOrderService;
import com.blinc.xpos.modules.inventory.service.SupplierService;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GoodsReceiptNoteServiceImpl implements GoodsReceiptNoteService {

  private final GoodsReceiptNoteRepository grnRepository;
  private final GrnLineRepository grnLineRepository;
  private final StockMovementRepository stockMovementRepository;
  private final InventoryItemService inventoryItemService;
  private final BranchService branchService;
  private final SupplierService supplierService;
  private final PurchaseOrderService purchaseOrderService;
  private final StaffUserService staffUserService;
  private final ItemService itemService;
  private final UomService uomService;
  private final Clock clock;

  public GoodsReceiptNoteServiceImpl(
      GoodsReceiptNoteRepository grnRepository,
      GrnLineRepository grnLineRepository,
      StockMovementRepository stockMovementRepository,
      InventoryItemService inventoryItemService,
      BranchService branchService,
      SupplierService supplierService,
      PurchaseOrderService purchaseOrderService,
      StaffUserService staffUserService,
      ItemService itemService,
      UomService uomService,
      Clock clock) {
    this.grnRepository = Objects.requireNonNull(grnRepository, "grnRepository");
    this.grnLineRepository = Objects.requireNonNull(grnLineRepository, "grnLineRepository");
    this.stockMovementRepository =
        Objects.requireNonNull(stockMovementRepository, "stockMovementRepository");
    this.inventoryItemService =
        Objects.requireNonNull(inventoryItemService, "inventoryItemService");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.supplierService = Objects.requireNonNull(supplierService, "supplierService");
    this.purchaseOrderService =
        Objects.requireNonNull(purchaseOrderService, "purchaseOrderService");
    this.staffUserService = Objects.requireNonNull(staffUserService, "staffUserService");
    this.itemService = Objects.requireNonNull(itemService, "itemService");
    this.uomService = Objects.requireNonNull(uomService, "uomService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public GoodsReceiptNote create(
      UUID orgId,
      UUID branchId,
      UUID supplierId,
      UUID purchaseOrderId,
      UUID receivedByStaffUserId,
      List<GrnLineRequest> lines) {
    var branch = branchService.require(orgId, branchId);
    var supplier = supplierService.require(orgId, supplierId);
    StaffUser staffUser = staffUserService.require(orgId, receivedByStaffUserId);
    Instant now = Instant.now(clock);

    GoodsReceiptNote grn = new GoodsReceiptNote();
    grn.setOrg(branch.getOrg());
    grn.setBranch(branch);
    grn.setSupplier(supplier);
    grn.setReceivedBy(staffUser);
    grn.setReceivedAt(now);
    grn.setCreatedAt(now);
    if (purchaseOrderId != null) {
      grn.setPurchaseOrder(purchaseOrderService.require(orgId, purchaseOrderId));
    }
    grn = grnRepository.save(grn);

    if (lines != null) {
      for (GrnLineRequest req : lines) {
        var item = itemService.require(orgId, req.itemId());
        var uom = (req.uomId() != null) ? uomService.require(orgId, req.uomId()) : null;
        if (req.qty() == null || req.qty().compareTo(BigDecimal.ZERO) <= 0) {
          throw new IllegalArgumentException("Line qty must be positive");
        }
        BigDecimal unitCost =
            item.getBuyingPrice() != null ? item.getBuyingPrice() : req.receivedUnitCost();
        GrnLine line = new GrnLine();
        line.setOrg(grn.getOrg());
        line.setGrn(grn);
        line.setItem(item);
        line.setQty(req.qty());
        line.setUom(uom);
        line.setReceivedUnitCost(unitCost);
        line.setCreatedAt(now);
        grnLineRepository.save(line);

        StockMovement mov = new StockMovement();
        mov.setOrg(grn.getOrg());
        mov.setBranch(grn.getBranch());
        mov.setItem(item);
        mov.setMovementType(MovementType.IN);
        mov.setQty(req.qty());
        mov.setUom(uom);
        mov.setUnitCost(unitCost);
        mov.setSourceType(SourceType.GRN);
        mov.setSourceId(grn.getId());
        mov.setCreatedBy(staffUser);
        mov.setCreatedAt(now);
        stockMovementRepository.save(mov);
        inventoryItemService.incrementOnHand(
            grn.getOrg().getId(), grn.getBranch().getId(), item.getId(), req.qty());
      }
    }
    return grn;
  }

  @Override
  @Transactional(readOnly = true)
  public GoodsReceiptNote require(UUID orgId, UUID grnId) {
    return grnRepository
        .findByIdAndOrgIdWithAssociations(grnId, orgId)
        .orElseThrow(
            () -> new NotFoundException("GRN_NOT_FOUND", "Goods receipt note not found: " + grnId));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<GoodsReceiptNote> listByBranch(
      UUID orgId, UUID branchId, boolean includeInactive, Pageable pageable) {
    branchService.require(orgId, branchId);
    return includeInactive
        ? grnRepository.findAllByOrgIdAndBranchId(orgId, branchId, pageable)
        : grnRepository.findAllByOrgIdAndBranchIdAndActiveTrue(
            orgId, branchId, pageable);
  }

  @Override
  @Transactional
  public GoodsReceiptNote update(
      UUID orgId,
      UUID grnId,
      UUID supplierId,
      Instant receivedAt,
      Boolean active,
      List<GrnLineRequest> lines,
      UUID updatedByStaffUserId) {
    GoodsReceiptNote grn = require(orgId, grnId);
    if (supplierId != null) {
      grn.setSupplier(supplierService.require(orgId, supplierId));
    }
    if (receivedAt != null) {
      grn.setReceivedAt(receivedAt);
    }
    if (active != null) {
      grn.setActive(active);
    }
    grn = grnRepository.save(grn);

    if (lines != null) {
      if (updatedByStaffUserId == null) {
        throw new IllegalArgumentException("updatedByStaffUserId required when updating GRN lines");
      }
      StaffUser staffUser = staffUserService.require(orgId, updatedByStaffUserId);
      Instant now = Instant.now(clock);
      List<GrnLine> existingLines =
          grnLineRepository.findByGrnIdOrderByCreatedAt(grn.getId());
      for (GrnLine line : existingLines) {
        StockMovement outMov = new StockMovement();
        outMov.setOrg(grn.getOrg());
        outMov.setBranch(grn.getBranch());
        outMov.setItem(line.getItem());
        outMov.setMovementType(MovementType.OUT);
        outMov.setQty(line.getQty());
        outMov.setUom(line.getUom());
        outMov.setUnitCost(line.getReceivedUnitCost());
        outMov.setSourceType(SourceType.GRN);
        outMov.setSourceId(grn.getId());
        outMov.setCreatedBy(staffUser);
        outMov.setCreatedAt(now);
        stockMovementRepository.save(outMov);
        inventoryItemService.decrementOnHand(
            grn.getOrg().getId(), grn.getBranch().getId(), line.getItem().getId(), line.getQty());
      }
      grnLineRepository.deleteAll(existingLines);

      for (GrnLineRequest req : lines) {
        var item = itemService.require(orgId, req.itemId());
        var uom = (req.uomId() != null) ? uomService.require(orgId, req.uomId()) : null;
        if (req.qty() == null || req.qty().compareTo(BigDecimal.ZERO) <= 0) {
          throw new IllegalArgumentException("Line qty must be positive");
        }
        BigDecimal unitCost =
            item.getBuyingPrice() != null ? item.getBuyingPrice() : req.receivedUnitCost();
        GrnLine line = new GrnLine();
        line.setOrg(grn.getOrg());
        line.setGrn(grn);
        line.setItem(item);
        line.setQty(req.qty());
        line.setUom(uom);
        line.setReceivedUnitCost(unitCost);
        line.setCreatedAt(now);
        grnLineRepository.save(line);

        StockMovement mov = new StockMovement();
        mov.setOrg(grn.getOrg());
        mov.setBranch(grn.getBranch());
        mov.setItem(item);
        mov.setMovementType(MovementType.IN);
        mov.setQty(req.qty());
        mov.setUom(uom);
        mov.setUnitCost(unitCost);
        mov.setSourceType(SourceType.GRN);
        mov.setSourceId(grn.getId());
        mov.setCreatedBy(staffUser);
        mov.setCreatedAt(now);
        stockMovementRepository.save(mov);
        inventoryItemService.incrementOnHand(
            grn.getOrg().getId(), grn.getBranch().getId(), item.getId(), req.qty());
      }
    }
    return grn;
  }
}
