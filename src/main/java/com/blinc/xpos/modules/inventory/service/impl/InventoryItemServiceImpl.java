package com.blinc.xpos.modules.inventory.service.impl;

import com.blinc.xpos.common.error.ConflictException;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.service.ItemService;
import com.blinc.xpos.modules.inventory.domain.InventoryItem;
import com.blinc.xpos.modules.inventory.repository.InventoryItemRepository;
import com.blinc.xpos.modules.inventory.service.InventoryItemService;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.pricing.service.PriceListItemService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InventoryItemServiceImpl implements InventoryItemService {

  private static final int SCALE = 3;

  private final InventoryItemRepository inventoryItemRepository;
  private final BranchService branchService;
  private final ItemService itemService;
  private final PriceListItemService priceListItemService;
  private final Clock clock;

  public InventoryItemServiceImpl(
      InventoryItemRepository inventoryItemRepository,
      BranchService branchService,
      ItemService itemService,
      @Lazy PriceListItemService priceListItemService,
      Clock clock) {
    this.inventoryItemRepository =
        Objects.requireNonNull(inventoryItemRepository, "inventoryItemRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.itemService = Objects.requireNonNull(itemService, "itemService");
    this.priceListItemService =
        Objects.requireNonNull(priceListItemService, "priceListItemService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional(readOnly = true)
  public BigDecimal getOnHandQty(UUID orgId, UUID branchId, UUID itemId) {
    return inventoryItemRepository
        .findByOrgIdAndBranchIdAndItemId(orgId, branchId, itemId)
        .map(InventoryItem::getOnHandQty)
        .orElse(BigDecimal.ZERO);
  }

  @Override
  @Transactional
  public void incrementOnHand(UUID orgId, UUID branchId, UUID itemId, BigDecimal qty) {
    if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) {
      throw new IllegalArgumentException("Quantity must be positive");
    }
    Branch branch = branchService.require(orgId, branchId);
    Item item = itemService.requireActive(orgId, itemId);
    BigDecimal qtyScaled = qty.setScale(SCALE, RoundingMode.HALF_UP);

    InventoryItem inv =
        inventoryItemRepository
            .findByOrgIdAndBranchIdAndItemId(orgId, branchId, itemId)
            .orElseGet(
                () -> {
                  InventoryItem created = new InventoryItem();
                  created.setOrg(branch.getOrg());
                  created.setBranch(branch);
                  created.setItem(item);
                  created.setOnHandQty(BigDecimal.ZERO);
                  created.setReservedQty(BigDecimal.ZERO);
                  created.setUpdatedAt(Instant.now(clock));
                  return inventoryItemRepository.save(created);
                });
    inv.setOnHandQty(inv.getOnHandQty().add(qtyScaled).setScale(SCALE, RoundingMode.HALF_UP));
    inv.setUpdatedAt(Instant.now(clock));
    inventoryItemRepository.save(inv);
  }

  @Override
  @Transactional
  public void decrementOnHand(UUID orgId, UUID branchId, UUID itemId, BigDecimal qty) {
    if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) {
      throw new IllegalArgumentException("Quantity must be positive");
    }
    BigDecimal qtyScaled = qty.setScale(SCALE, RoundingMode.HALF_UP);

    InventoryItem inv =
        inventoryItemRepository
            .findByOrgIdAndBranchIdAndItemId(orgId, branchId, itemId)
            .orElseThrow(
                () ->
                    new ConflictException(
                        "INSUFFICIENT_STOCK",
                        "No stock record for item. Stock may not have been received yet."));

    BigDecimal after = inv.getOnHandQty().subtract(qtyScaled).setScale(SCALE, RoundingMode.HALF_UP);
    if (after.compareTo(BigDecimal.ZERO) < 0) {
      throw new ConflictException(
          "INSUFFICIENT_STOCK",
          "Insufficient stock for "
              + inv.getItem().getName()
              + ". Only "
              + inv.getOnHandQty()
              + " remaining. (Hakuna stock ya kutosha.)");
    }
    inv.setOnHandQty(after);
    inv.setUpdatedAt(Instant.now(clock));
    inventoryItemRepository.save(inv);
    if (after.compareTo(BigDecimal.ZERO) <= 0) {
      Item catalogItem = itemService.require(orgId, itemId);
      if (catalogItem.requiresOnHandForSellableListing()) {
        priceListItemService.purgePriceListLinesForTrackedItemIfOutOfStock(orgId, itemId);
      }
    }
  }

  @Override
  @Transactional
  public void decrementOnHandClampToZeroForInactiveItem(
      UUID orgId, UUID branchId, UUID itemId, BigDecimal qty) {
    if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) {
      throw new IllegalArgumentException("Quantity must be positive");
    }
    BigDecimal qtyScaled = qty.setScale(SCALE, RoundingMode.HALF_UP);
    inventoryItemRepository
        .findByOrgIdAndBranchIdAndItemId(orgId, branchId, itemId)
        .ifPresent(
            inv -> {
              BigDecimal after =
                  inv.getOnHandQty().subtract(qtyScaled).setScale(SCALE, RoundingMode.HALF_UP);
              if (after.compareTo(BigDecimal.ZERO) < 0) {
                after = BigDecimal.ZERO.setScale(SCALE, RoundingMode.HALF_UP);
              }
              inv.setOnHandQty(after);
              inv.setUpdatedAt(Instant.now(clock));
              inventoryItemRepository.save(inv);
              if (after.compareTo(BigDecimal.ZERO) <= 0) {
                Item catalogItem = itemService.require(orgId, itemId);
                if (catalogItem.requiresOnHandForSellableListing()) {
                  priceListItemService.purgePriceListLinesForTrackedItemIfOutOfStock(orgId, itemId);
                }
              }
            });
  }

  @Override
  @Transactional(readOnly = true)
  public Map<UUID, BigDecimal> getOnHandQtysByItemIds(
      UUID orgId, UUID branchId, Set<UUID> itemIds) {
    Map<UUID, BigDecimal> result = new HashMap<>();
    for (UUID itemId : itemIds) {
      result.put(itemId, getOnHandQty(orgId, branchId, itemId));
    }
    return result;
  }

  @Override
  @Transactional
  public void applyStockTakeVariance(
      UUID orgId, UUID branchId, UUID itemId, BigDecimal varianceDelta) {
    if (varianceDelta == null || varianceDelta.compareTo(BigDecimal.ZERO) == 0) {
      return;
    }
    Branch branch = branchService.require(orgId, branchId);
    Item item = itemService.require(orgId, itemId);
    BigDecimal delta = varianceDelta.setScale(SCALE, RoundingMode.HALF_UP);

    InventoryItem inv =
        inventoryItemRepository
            .findByOrgIdAndBranchIdAndItemId(orgId, branchId, itemId)
            .orElseGet(
                () -> {
                  InventoryItem created = new InventoryItem();
                  created.setOrg(branch.getOrg());
                  created.setBranch(branch);
                  created.setItem(item);
                  created.setOnHandQty(BigDecimal.ZERO);
                  created.setReservedQty(BigDecimal.ZERO);
                  created.setUpdatedAt(Instant.now(clock));
                  return inventoryItemRepository.save(created);
                });
    inv.setOnHandQty(inv.getOnHandQty().add(delta).setScale(SCALE, RoundingMode.HALF_UP));
    inv.setUpdatedAt(Instant.now(clock));
    inventoryItemRepository.save(inv);
    BigDecimal onHand = inv.getOnHandQty();
    if (onHand.compareTo(BigDecimal.ZERO) <= 0 && item.requiresOnHandForSellableListing()) {
      priceListItemService.purgePriceListLinesForTrackedItemIfOutOfStock(orgId, itemId);
    }
  }
}
