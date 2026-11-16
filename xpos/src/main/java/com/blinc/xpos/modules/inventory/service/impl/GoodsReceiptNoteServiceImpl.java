package com.blinc.xpos.modules.inventory.service.impl;

import com.blinc.xpos.common.constants.enums.MovementType;
import com.blinc.xpos.common.constants.enums.SourceType;
import com.blinc.xpos.common.error.ConflictException;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.domain.Uom;
import com.blinc.xpos.modules.catalog.service.ItemService;
import com.blinc.xpos.modules.catalog.service.UomService;
import com.blinc.xpos.modules.inventory.domain.GoodsReceiptNote;
import com.blinc.xpos.modules.inventory.domain.GrnLine;
import com.blinc.xpos.modules.inventory.domain.StockMovement;
import com.blinc.xpos.modules.inventory.domain.Supplier;
import com.blinc.xpos.modules.inventory.repository.GoodsReceiptNoteRepository;
import com.blinc.xpos.modules.inventory.repository.GrnLineRepository;
import com.blinc.xpos.modules.inventory.repository.StockMovementRepository;
import com.blinc.xpos.modules.inventory.service.GoodsReceiptNoteService;
import com.blinc.xpos.modules.inventory.service.InventoryItemService;
import com.blinc.xpos.modules.inventory.service.PurchaseOrderService;
import com.blinc.xpos.modules.inventory.service.SupplierService;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GoodsReceiptNoteServiceImpl implements GoodsReceiptNoteService {

  /**
   * Calendar day for merging repeat receipts (same branch, supplier, item) is evaluated in this
   * zone (Kenya operations).
   */
  private static final ZoneId GOODS_RECEIPT_MERGE_DAY_ZONE = ZoneId.of("Africa/Nairobi");

  private record GrnLineKey(UUID itemId, UUID uomId) {}

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
      Instant receivedAt,
      List<GrnLineRequest> lines) {
    var branch = branchService.require(orgId, branchId);
    var supplier = supplierService.require(orgId, supplierId);
    StaffUser staffUser = staffUserService.require(orgId, receivedByStaffUserId);
    Instant now = Instant.now(clock);
    Instant effectiveReceivedAt = receivedAt != null ? receivedAt : now;
    List<GrnLineRequest> normalized = normalizeDuplicateLineRequests(lines);

    if (purchaseOrderId == null && normalized != null && !normalized.isEmpty()) {
      Instant dayStart = startOfMergeZoneDay(effectiveReceivedAt, GOODS_RECEIPT_MERGE_DAY_ZONE);
      Instant dayEndExclusive =
          endOfMergeZoneDayExclusive(effectiveReceivedAt, GOODS_RECEIPT_MERGE_DAY_ZONE);
      List<GoodsReceiptNote> mergeTargets =
          grnRepository.findActiveWithoutPoForMergeSameDay(
              orgId, branchId, supplierId, dayStart, dayEndExclusive, PageRequest.of(0, 1));
      if (!mergeTargets.isEmpty()) {
        return mergeIntoExistingGrn(
            mergeTargets.getFirst(), normalized, staffUser, effectiveReceivedAt, now);
      }
    }

    return createNewGrn(
        branch, supplier, orgId, purchaseOrderId, staffUser, effectiveReceivedAt, now, normalized);
  }

  private static Instant startOfMergeZoneDay(Instant instant, ZoneId zone) {
    return instant.atZone(zone).toLocalDate().atStartOfDay(zone).toInstant();
  }

  private static Instant endOfMergeZoneDayExclusive(Instant instant, ZoneId zone) {
    return instant.atZone(zone).toLocalDate().plusDays(1).atStartOfDay(zone).toInstant();
  }

  private List<GrnLineRequest> normalizeDuplicateLineRequests(List<GrnLineRequest> lines) {
    if (lines == null) {
      return null;
    }
    if (lines.isEmpty()) {
      return List.of();
    }
    Map<GrnLineKey, BigDecimal> qtyByKey = new LinkedHashMap<>();
    Map<GrnLineKey, BigDecimal> lastCostByKey = new HashMap<>();
    for (GrnLineRequest req : lines) {
      GrnLineKey key = new GrnLineKey(req.itemId(), req.uomId());
      qtyByKey.merge(key, req.qty(), BigDecimal::add);
      if (req.receivedUnitCost() != null) {
        lastCostByKey.put(key, req.receivedUnitCost());
      }
    }
    List<GrnLineRequest> out = new ArrayList<>(qtyByKey.size());
    for (Map.Entry<GrnLineKey, BigDecimal> e : qtyByKey.entrySet()) {
      GrnLineKey key = e.getKey();
      out.add(new GrnLineRequest(key.itemId(), e.getValue(), key.uomId(), lastCostByKey.get(key)));
    }
    return out;
  }

  private BigDecimal resolveReceivedUnitCost(Item item) {
    if (item.getBuyingPrice() == null) {
      throw new ConflictException(
          "ITEM_NO_BUYING_PRICE",
          "Item '"
              + item.getName()
              + "' has no buying price. Set a buying price in Catalog before receiving stock.");
    }
    return item.getBuyingPrice();
  }

  /**
   * Enforces one unit cost per item for stock receipts when the item has no catalog buying price:
   * new lines must match prior GRN unit costs for the org. When buying price is set, it is the
   * source of truth. Same-day merge into an existing line must not change unit cost unless buying
   * price overrides.
   */
  private void assertGrnLineResolvedUnitCostAllowed(
      UUID orgId,
      UUID excludeGrnId,
      UUID itemId,
      BigDecimal resolvedUnitCost,
      String itemDisplayName,
      BigDecimal mergeIntoExistingLinePreviousCostOrNull) {
    Objects.requireNonNull(resolvedUnitCost, "resolvedUnitCost");
    Item item = itemService.requireActive(orgId, itemId);
    if (item.getBuyingPrice() != null) {
      if (item.getBuyingPrice().compareTo(resolvedUnitCost) != 0) {
        throw new ConflictException(
            "GRN_ITEM_UNIT_COST_NOT_BUYING_PRICE",
            "Unit cost must match the item buying price in Catalog for "
                + itemDisplayName
                + ". Update the item in Catalog to change the buying price.");
      }
      return;
    }
    List<BigDecimal> fromOtherGrns =
        grnLineRepository.findDistinctReceivedUnitCostsByOrgAndItemExcludingGrn(
            orgId, itemId, excludeGrnId);
    if (fromOtherGrns.size() > 1) {
      throw new ConflictException(
          "GRN_ITEM_UNIT_COST_AMBIGUOUS",
          "This item has multiple unit costs across stock receipts. Set one buying price on the item in"
              + " Catalog (Items), then receive stock using that price.");
    }
    if (fromOtherGrns.size() == 1) {
      BigDecimal canonical = fromOtherGrns.getFirst();
      if (canonical.compareTo(resolvedUnitCost) != 0) {
        throw new ConflictException(
            "GRN_ITEM_UNIT_COST_MISMATCH",
            "This item was already received at unit cost "
                + canonical.stripTrailingZeros().toPlainString()
                + ". Use that unit cost for "
                + itemDisplayName
                + ", or set the buying price in Catalog (Items) so all receipts use one price.");
      }
    }
    if (mergeIntoExistingLinePreviousCostOrNull != null
        && mergeIntoExistingLinePreviousCostOrNull.compareTo(resolvedUnitCost) != 0) {
      throw new ConflictException(
          "GRN_ITEM_UNIT_COST_MERGE_MISMATCH",
          "Merged receipt lines must use the same unit cost as the existing line ("
              + mergeIntoExistingLinePreviousCostOrNull.stripTrailingZeros().toPlainString()
              + ") for "
              + itemDisplayName
              + ".");
    }
  }

  private void persistStockInForGrn(
      GoodsReceiptNote grn,
      Item item,
      Uom uom,
      BigDecimal qty,
      BigDecimal unitCost,
      StaffUser staffUser,
      Instant now) {
    StockMovement mov = new StockMovement();
    mov.setOrg(grn.getOrg());
    mov.setBranch(grn.getBranch());
    mov.setItem(item);
    mov.setMovementType(MovementType.IN);
    mov.setQty(qty);
    mov.setUom(uom);
    mov.setUnitCost(unitCost);
    mov.setSourceType(SourceType.GRN);
    mov.setSourceId(grn.getId());
    mov.setCreatedBy(staffUser);
    mov.setCreatedAt(now);
    stockMovementRepository.save(mov);
    inventoryItemService.incrementOnHand(
        grn.getOrg().getId(), grn.getBranch().getId(), item.getId(), qty);
  }

  private GrnLine findGrnLineWithItemAndUom(List<GrnLine> lines, UUID itemId, Uom uom) {
    UUID wantedUomId = uom != null ? uom.getId() : null;
    for (GrnLine line : lines) {
      if (!line.getItem().getId().equals(itemId)) {
        continue;
      }
      UUID lineUomId = line.getUom() != null ? line.getUom().getId() : null;
      if (Objects.equals(lineUomId, wantedUomId)) {
        return line;
      }
    }
    return null;
  }

  private static GrnLineKey grnLineKeyFromGrnLine(GrnLine line) {
    UUID uomId = line.getUom() != null ? line.getUom().getId() : null;
    return new GrnLineKey(line.getItem().getId(), uomId);
  }

  private BigDecimal weightedReceivedUnitCost(List<GrnLine> lines, GrnLineKey key) {
    BigDecimal numerator = BigDecimal.ZERO;
    BigDecimal denominator = BigDecimal.ZERO;
    for (GrnLine line : lines) {
      if (!grnLineKeyFromGrnLine(line).equals(key)) {
        continue;
      }
      BigDecimal quantity = line.getQty();
      BigDecimal cost =
          line.getReceivedUnitCost() != null ? line.getReceivedUnitCost() : BigDecimal.ZERO;
      numerator = numerator.add(quantity.multiply(cost));
      denominator = denominator.add(quantity);
    }
    if (denominator.compareTo(BigDecimal.ZERO) == 0) {
      return BigDecimal.ZERO;
    }
    return numerator.divide(denominator, 8, RoundingMode.HALF_UP);
  }

  private void applyNetStockAdjustmentsForGrnLineReplace(
      GoodsReceiptNote grn,
      UUID orgId,
      UUID branchId,
      List<GrnLine> existingLines,
      List<GrnLineRequest> normalizedNew,
      StaffUser staffUser,
      Instant now) {
    Map<GrnLineKey, BigDecimal> oldQtyByKey = new LinkedHashMap<>();
    for (GrnLine line : existingLines) {
      GrnLineKey key = grnLineKeyFromGrnLine(line);
      oldQtyByKey.merge(key, line.getQty(), BigDecimal::add);
    }
    Map<GrnLineKey, GrnLineRequest> newReqByKey = new LinkedHashMap<>();
    for (GrnLineRequest req : normalizedNew) {
      newReqByKey.put(new GrnLineKey(req.itemId(), req.uomId()), req);
    }
    Set<GrnLineKey> allKeys = new LinkedHashSet<>();
    allKeys.addAll(oldQtyByKey.keySet());
    allKeys.addAll(newReqByKey.keySet());
    for (GrnLineKey key : allKeys) {
      BigDecimal oldQuantity = oldQtyByKey.getOrDefault(key, BigDecimal.ZERO);
      GrnLineRequest newReq = newReqByKey.get(key);
      BigDecimal newQuantity = newReq != null ? newReq.qty() : BigDecimal.ZERO;
      BigDecimal delta = newQuantity.subtract(oldQuantity);
      if (delta.compareTo(BigDecimal.ZERO) == 0) {
        continue;
      }
      Item item = itemService.requireActive(orgId, key.itemId());
      Uom uom = key.uomId() != null ? uomService.require(orgId, key.uomId()) : null;
      if (delta.compareTo(BigDecimal.ZERO) > 0) {
        BigDecimal unitCost = resolveReceivedUnitCost(item);
        assertGrnLineResolvedUnitCostAllowed(
            orgId, grn.getId(), item.getId(), unitCost, item.getName(), null);
        persistStockInForGrn(grn, item, uom, delta, unitCost, staffUser, now);
      } else {
        BigDecimal outQuantity = delta.negate();
        BigDecimal unitCostOut = weightedReceivedUnitCost(existingLines, key);
        StockMovement outMov = new StockMovement();
        outMov.setOrg(grn.getOrg());
        outMov.setBranch(grn.getBranch());
        outMov.setItem(item);
        outMov.setMovementType(MovementType.OUT);
        outMov.setQty(outQuantity);
        outMov.setUom(uom);
        outMov.setUnitCost(unitCostOut);
        outMov.setSourceType(SourceType.GRN);
        outMov.setSourceId(grn.getId());
        outMov.setCreatedBy(staffUser);
        outMov.setCreatedAt(now);
        stockMovementRepository.save(outMov);
        inventoryItemService.decrementOnHand(orgId, branchId, item.getId(), outQuantity);
      }
    }
  }

  private void persistReplacementGrnLinesOnly(
      GoodsReceiptNote grn, UUID orgId, List<GrnLineRequest> normalizedNew, Instant now) {
    for (GrnLineRequest req : normalizedNew) {
      Item item = itemService.requireActive(orgId, req.itemId());
      Uom uom = req.uomId() != null ? uomService.require(orgId, req.uomId()) : null;
      if (req.qty() == null || req.qty().compareTo(BigDecimal.ZERO) <= 0) {
        throw new IllegalArgumentException("Line qty must be positive");
      }
      BigDecimal unitCost = resolveReceivedUnitCost(item);
      assertGrnLineResolvedUnitCostAllowed(
          orgId, grn.getId(), item.getId(), unitCost, item.getName(), null);
      GrnLine line = new GrnLine();
      line.setOrg(grn.getOrg());
      line.setGrn(grn);
      line.setItem(item);
      line.setQty(req.qty());
      line.setUom(uom);
      line.setReceivedUnitCost(unitCost);
      line.setCreatedAt(now);
      grnLineRepository.save(line);
    }
  }

  private GoodsReceiptNote mergeIntoExistingGrn(
      GoodsReceiptNote grn,
      List<GrnLineRequest> incoming,
      StaffUser staffUser,
      Instant effectiveReceivedAt,
      Instant now) {
    UUID orgId = grn.getOrg().getId();
    grn.setReceivedAt(effectiveReceivedAt);
    grnRepository.save(grn);

    List<GrnLine> workingLines =
        new ArrayList<>(grnLineRepository.findByGrnIdOrderByCreatedAt(grn.getId()));

    for (GrnLineRequest req : incoming) {
      Item item = itemService.requireActive(orgId, req.itemId());
      Uom uom = req.uomId() != null ? uomService.require(orgId, req.uomId()) : null;
      if (req.qty() == null || req.qty().compareTo(BigDecimal.ZERO) <= 0) {
        throw new IllegalArgumentException("Line qty must be positive");
      }
      BigDecimal unitCost = resolveReceivedUnitCost(item);
      GrnLine existing = findGrnLineWithItemAndUom(workingLines, item.getId(), uom);
      if (existing != null) {
        assertGrnLineResolvedUnitCostAllowed(
            orgId,
            grn.getId(),
            item.getId(),
            unitCost,
            item.getName(),
            existing.getReceivedUnitCost());
        existing.setQty(existing.getQty().add(req.qty()));
        existing.setReceivedUnitCost(unitCost);
        existing.setUom(uom);
        grnLineRepository.save(existing);
      } else {
        assertGrnLineResolvedUnitCostAllowed(
            orgId, grn.getId(), item.getId(), unitCost, item.getName(), null);
        GrnLine line = new GrnLine();
        line.setOrg(grn.getOrg());
        line.setGrn(grn);
        line.setItem(item);
        line.setQty(req.qty());
        line.setUom(uom);
        line.setReceivedUnitCost(unitCost);
        line.setCreatedAt(effectiveReceivedAt);
        grnLineRepository.save(line);
        workingLines.add(line);
      }
      persistStockInForGrn(grn, item, uom, req.qty(), unitCost, staffUser, effectiveReceivedAt);
    }
    return require(orgId, grn.getId());
  }

  private GoodsReceiptNote createNewGrn(
      Branch branch,
      Supplier supplier,
      UUID orgId,
      UUID purchaseOrderId,
      StaffUser staffUser,
      Instant effectiveReceivedAt,
      Instant now,
      List<GrnLineRequest> normalized) {
    GoodsReceiptNote grn = new GoodsReceiptNote();
    grn.setOrg(branch.getOrg());
    grn.setBranch(branch);
    grn.setSupplier(supplier);
    grn.setReceivedBy(staffUser);
    grn.setReceivedAt(effectiveReceivedAt);
    grn.setCreatedAt(now);
    if (purchaseOrderId != null) {
      grn.setPurchaseOrder(purchaseOrderService.require(orgId, purchaseOrderId));
    }
    grn = grnRepository.save(grn);

    if (normalized != null) {
      for (GrnLineRequest req : normalized) {
        Item item = itemService.requireActive(orgId, req.itemId());
        Uom uom = req.uomId() != null ? uomService.require(orgId, req.uomId()) : null;
        if (req.qty() == null || req.qty().compareTo(BigDecimal.ZERO) <= 0) {
          throw new IllegalArgumentException("Line qty must be positive");
        }
        BigDecimal unitCost = resolveReceivedUnitCost(item);
        assertGrnLineResolvedUnitCostAllowed(
            orgId, grn.getId(), item.getId(), unitCost, item.getName(), null);
        GrnLine line = new GrnLine();
        line.setOrg(grn.getOrg());
        line.setGrn(grn);
        line.setItem(item);
        line.setQty(req.qty());
        line.setUom(uom);
        line.setReceivedUnitCost(unitCost);
        line.setCreatedAt(effectiveReceivedAt);
        grnLineRepository.save(line);
        persistStockInForGrn(grn, item, uom, req.qty(), unitCost, staffUser, effectiveReceivedAt);
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
            () -> new NotFoundException("GRN_NOT_FOUND", "Stock receipt not found: " + grnId));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<GoodsReceiptNote> listByBranch(
      UUID orgId, UUID branchId, boolean includeInactive, Pageable pageable) {
    branchService.require(orgId, branchId);
    return includeInactive
        ? grnRepository.findAllByOrgIdAndBranchId(orgId, branchId, pageable)
        : grnRepository.findAllByOrgIdAndBranchIdAndActiveTrue(orgId, branchId, pageable);
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
    boolean previouslyActive = Boolean.TRUE.equals(grn.getActive());
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

    if (lines == null && active != null && !active && previouslyActive) {
      reverseStockMovementsForGrnAndPurgePricing(orgId, grn.getId(), grn.getBranch().getId());
    }

    if (lines != null) {
      if (updatedByStaffUserId == null) {
        throw new IllegalArgumentException("updatedByStaffUserId required when updating GRN lines");
      }
      StaffUser staffUser = staffUserService.require(orgId, updatedByStaffUserId);
      Instant now = Instant.now(clock);
      List<GrnLine> existingLines = grnLineRepository.findByGrnIdOrderByCreatedAt(grn.getId());
      List<GrnLineRequest> normalizedNew = normalizeDuplicateLineRequests(lines);
      applyNetStockAdjustmentsForGrnLineReplace(
          grn, orgId, grn.getBranch().getId(), existingLines, normalizedNew, staffUser, now);
      grnLineRepository.deleteAll(existingLines);
      persistReplacementGrnLinesOnly(grn, orgId, normalizedNew, now);
    }
    return grn;
  }

  @Override
  @Transactional
  public void deletePermanently(UUID orgId, UUID grnId) {
    GoodsReceiptNote grn = require(orgId, grnId);
    UUID branchId = grn.getBranch().getId();
    reverseStockMovementsForGrnAndPurgePricing(orgId, grnId, branchId);
    List<GrnLine> lines = grnLineRepository.findByGrnIdOrderByCreatedAt(grnId);
    if (!lines.isEmpty()) {
      grnLineRepository.deleteAll(lines);
    }
    grnRepository.delete(grn);
  }

  private void reverseStockMovementsForGrnAndPurgePricing(UUID orgId, UUID grnId, UUID branchId) {
    List<StockMovement> movements =
        stockMovementRepository.findAllByOrgIdAndSourceTypeAndSourceIdOrderByCreatedAtAsc(
            orgId, SourceType.GRN, grnId);
    Set<UUID> affectedItemIds = new LinkedHashSet<>();
    for (StockMovement m : movements) {
      affectedItemIds.add(m.getItem().getId());
    }
    reverseGrnMovementsOnInventory(orgId, branchId, movements);
    if (!movements.isEmpty()) {
      stockMovementRepository.deleteAll(movements);
    }
  }

  private void reverseGrnMovementsOnInventory(
      UUID orgId, UUID branchId, List<StockMovement> movements) {
    for (StockMovement m : movements) {
      UUID itemId = m.getItem().getId();
      BigDecimal qty = m.getQty();
      if (m.getMovementType() == MovementType.IN) {
        boolean active = Boolean.TRUE.equals(m.getItem().getActive());
        if (active) {
          inventoryItemService.decrementOnHand(orgId, branchId, itemId, qty);
        } else {
          inventoryItemService.decrementOnHandClampToZeroForInactiveItem(
              orgId, branchId, itemId, qty);
        }
      } else if (m.getMovementType() == MovementType.OUT) {
        inventoryItemService.incrementOnHand(orgId, branchId, itemId, qty);
      } else {
        throw new ConflictException(
            "GRN_DELETE_UNSUPPORTED_MOVEMENT",
            "This receipt is linked to stock movements that cannot be removed automatically. "
                + "Contact support with the receipt id.");
      }
    }
  }
}
