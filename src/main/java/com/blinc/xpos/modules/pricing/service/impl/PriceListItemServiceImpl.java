package com.blinc.xpos.modules.pricing.service.impl;

import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.common.error.ConflictException;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.service.ItemService;
import com.blinc.xpos.modules.inventory.repository.InventoryItemRepository;
import com.blinc.xpos.modules.inventory.repository.StockMovementRepository;
import com.blinc.xpos.modules.inventory.service.InventoryItemService;
import com.blinc.xpos.modules.pricing.domain.PriceList;
import com.blinc.xpos.modules.pricing.domain.PriceListItem;
import com.blinc.xpos.modules.pricing.repository.PriceListItemRepository;
import com.blinc.xpos.modules.pricing.service.PriceListItemService;
import com.blinc.xpos.modules.pricing.service.PriceListService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PriceListItemServiceImpl implements PriceListItemService {

  private static final String DEFAULT_CURRENCY = "KES";

  private final PriceListItemRepository priceListItemRepository;
  private final PriceListService priceListService;
  private final ItemService itemService;
  private final StockMovementRepository stockMovementRepository;
  private final InventoryItemService inventoryItemService;
  private final InventoryItemRepository inventoryItemRepository;
  private final Clock clock;

  public PriceListItemServiceImpl(
      PriceListItemRepository priceListItemRepository,
      PriceListService priceListService,
      ItemService itemService,
      StockMovementRepository stockMovementRepository,
      InventoryItemService inventoryItemService,
      InventoryItemRepository inventoryItemRepository,
      Clock clock) {
    this.priceListItemRepository =
        Objects.requireNonNull(priceListItemRepository, "priceListItemRepository");
    this.priceListService = Objects.requireNonNull(priceListService, "priceListService");
    this.itemService = Objects.requireNonNull(itemService, "itemService");
    this.stockMovementRepository =
        Objects.requireNonNull(stockMovementRepository, "stockMovementRepository");
    this.inventoryItemService =
        Objects.requireNonNull(inventoryItemService, "inventoryItemService");
    this.inventoryItemRepository =
        Objects.requireNonNull(inventoryItemRepository, "inventoryItemRepository");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  private static final String MSG_NO_PURCHASE_HISTORY =
      "Item has no purchase history. You cannot sell what you don't have. "
          + "Go to Inventory → Stock, receive stock when stock arrives, "
          + "record the unit cost, then add the item to this price list.";

  @Override
  @Transactional(readOnly = true)
  public BigDecimal resolveCostFloor(UUID orgId, Item item) {
    return resolveFloorUnitCost(orgId, item);
  }

  /**
   * Minimum allowed cost floor: max unit cost from active stock receipts (and other IN movements
   * with unit cost), compared with catalog buying price. Movements from inactive (deleted) GRNs are
   * ignored; if none remain, catalog buying price is the floor when set.
   */
  private BigDecimal resolveFloorUnitCost(UUID orgId, Item item) {
    BigDecimal maxFromMovements =
        stockMovementRepository.findMaxUnitCostByOrgAndItem(orgId, item.getId());
    BigDecimal buying = item.getBuyingPrice();
    if (maxFromMovements == null) {
      return buying;
    }
    if (buying != null && buying.compareTo(maxFromMovements) > 0) {
      return buying;
    }
    return maxFromMovements;
  }

  private boolean trackedItemHasStockInPriceListScope(UUID orgId, Item item, PriceList priceList) {
    if (!item.requiresOnHandForSellableListing()) {
      return true;
    }
    if (priceList.getBranch() != null) {
      return inventoryItemService
              .getOnHandQty(orgId, priceList.getBranch().getId(), item.getId())
              .compareTo(BigDecimal.ZERO)
          > 0;
    }
    return inventoryItemRepository.countWithPositiveOnHandByOrgAndItem(orgId, item.getId()) > 0;
  }

  @Override
  @Transactional
  public void purgePriceListLinesForTrackedItemIfOutOfStock(UUID orgId, UUID itemId) {
    Item item = itemService.require(orgId, itemId);
    if (!item.requiresOnHandForSellableListing()) {
      return;
    }
    List<PriceListItem> lines =
        priceListItemRepository.findAllByOrgIdAndItemIdWithPriceListAndItem(orgId, itemId);
    List<PriceListItem> toRemove = new ArrayList<>();
    for (PriceListItem line : lines) {
      if (!trackedItemHasStockInPriceListScope(orgId, item, line.getPriceList())) {
        toRemove.add(line);
      }
    }
    if (!toRemove.isEmpty()) {
      priceListItemRepository.deleteAll(toRemove);
    }
  }

  @Override
  @Transactional
  public PriceListItem add(
      UUID orgId, UUID priceListId, UUID itemId, BigDecimal price, String currency) {
    PriceList priceList = priceListService.require(orgId, priceListId);
    Item item = itemService.requireActive(orgId, itemId);

    if (priceListItemRepository
        .findByPriceListIdAndItemIdAndOrgId(priceListId, itemId, orgId)
        .isPresent()) {
      throw new ConflictException(
          "PRICE_LIST_ITEM_DUPLICATE", "This item already has a price in this price list.");
    }

    BigDecimal sellingPrice = price != null ? price : BigDecimal.ZERO;
    BigDecimal floorUnitCost = resolveFloorUnitCost(orgId, item);
    if (floorUnitCost == null) {
      throw new BadRequestException("ITEM_NOT_SUPPLIED", MSG_NO_PURCHASE_HISTORY);
    }

    if (sellingPrice.compareTo(floorUnitCost) <= 0) {
      throw new BadRequestException(
          "SELLING_PRICE_BELOW_COST",
          "Selling price must be greater than buying price (cost: "
              + floorUnitCost
              + "). Reduce cost or increase selling price.");
    }

    PriceListItem line = new PriceListItem();
    line.setOrg(priceList.getOrg());
    line.setPriceList(priceList);
    line.setItem(item);
    line.setPrice(sellingPrice);
    line.setCurrency(currency != null && !currency.isBlank() ? currency : DEFAULT_CURRENCY);
    line.setCreatedAt(Instant.now(clock));
    return priceListItemRepository.save(line);
  }

  @Override
  @Transactional
  public PriceListItem ensureInPriceList(
      UUID orgId, UUID priceListId, UUID itemId, BigDecimal price, String currency) {
    Optional<PriceListItem> existing =
        priceListItemRepository.findByPriceListIdAndItemIdAndOrgId(priceListId, itemId, orgId);
    if (existing.isPresent()) {
      return update(
          orgId,
          priceListId,
          existing.get().getId(),
          price,
          currency != null && !currency.isBlank() ? currency : DEFAULT_CURRENCY);
    }
    return add(orgId, priceListId, itemId, price, currency);
  }

  @Override
  @Transactional(readOnly = true)
  public PriceListItem requireInPriceList(UUID orgId, UUID priceListId, UUID priceListItemId) {
    PriceListItem line =
        priceListItemRepository
            .findByIdAndOrgId(priceListItemId, orgId)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "PRICE_LIST_ITEM_NOT_FOUND", "Price list item not found"));
    if (!line.getPriceList().getId().equals(priceListId)) {
      throw new NotFoundException(
          "PRICE_LIST_ITEM_NOT_FOUND", "Price list item not found in this price list");
    }
    return line;
  }

  @Override
  @Transactional
  public PriceListItem update(
      UUID orgId, UUID priceListId, UUID priceListItemId, BigDecimal price, String currency) {
    PriceListItem line = requireInPriceList(orgId, priceListId, priceListItemId);
    itemService.requireActive(orgId, line.getItem().getId());

    BigDecimal sellingPrice = price != null ? price : BigDecimal.ZERO;
    Item lineItem = line.getItem();
    BigDecimal floorUnitCost = resolveFloorUnitCost(orgId, lineItem);
    if (floorUnitCost == null) {
      throw new BadRequestException("ITEM_NOT_SUPPLIED", MSG_NO_PURCHASE_HISTORY);
    }

    if (sellingPrice.compareTo(floorUnitCost) <= 0) {
      throw new BadRequestException(
          "SELLING_PRICE_BELOW_COST",
          "Selling price must be greater than buying price (cost: "
              + floorUnitCost
              + "). Reduce cost or increase selling price.");
    }

    line.setPrice(sellingPrice);
    line.setCurrency(currency != null && !currency.isBlank() ? currency : DEFAULT_CURRENCY);
    return priceListItemRepository.save(line);
  }

  @Override
  @Transactional(readOnly = true)
  public List<PriceListItem> listByPriceList(UUID orgId, UUID priceListId) {
    priceListService.require(orgId, priceListId);
    return priceListItemRepository.findAllByPriceListIdAndOrgIdInStockForAdmin(priceListId, orgId);
  }

  @Override
  @Transactional(readOnly = true)
  public Page<PriceListItem> listByPriceList(UUID orgId, UUID priceListId, Pageable pageable) {
    priceListService.require(orgId, priceListId);
    return priceListItemRepository.findByPriceListIdAndOrgIdInStockForAdmin(
        priceListId, orgId, pageable);
  }

  @Override
  @Transactional
  public void remove(UUID orgId, UUID priceListId, UUID priceListItemId) {
    PriceListItem line = requireInPriceList(orgId, priceListId, priceListItemId);
    priceListItemRepository.delete(line);
  }

  @Override
  @Transactional
  public void removeAllListItemsForItem(UUID orgId, UUID itemId) {
    var rows = priceListItemRepository.findAllByOrgIdAndItemId(orgId, itemId);
    if (!rows.isEmpty()) {
      priceListItemRepository.deleteAll(rows);
    }
  }
}
