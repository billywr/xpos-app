package com.blinc.xpos.modules.pricing.service.impl;

import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.service.ItemService;
import com.blinc.xpos.modules.inventory.repository.StockMovementRepository;
import com.blinc.xpos.modules.pricing.domain.PriceList;
import com.blinc.xpos.modules.pricing.domain.PriceListItem;
import com.blinc.xpos.modules.pricing.repository.PriceListItemRepository;
import com.blinc.xpos.modules.pricing.service.PriceListItemService;
import com.blinc.xpos.modules.pricing.service.PriceListService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
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
  private final Clock clock;

  public PriceListItemServiceImpl(
      PriceListItemRepository priceListItemRepository,
      PriceListService priceListService,
      ItemService itemService,
      StockMovementRepository stockMovementRepository,
      Clock clock) {
    this.priceListItemRepository =
        Objects.requireNonNull(priceListItemRepository, "priceListItemRepository");
    this.priceListService = Objects.requireNonNull(priceListService, "priceListService");
    this.itemService = Objects.requireNonNull(itemService, "itemService");
    this.stockMovementRepository =
        Objects.requireNonNull(stockMovementRepository, "stockMovementRepository");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  private static final String MSG_NO_PURCHASE_HISTORY =
      "Item has no purchase history. You cannot sell what you don't have. "
          + "Go to Inventory → Goods Receipt Notes, create a Goods Receipt when you receive stock, "
          + "record the unit cost, then add the item to this price list.";

  @Override
  @Transactional
  public PriceListItem add(
      UUID orgId, UUID priceListId, UUID itemId, BigDecimal price, String currency) {
    PriceList priceList = priceListService.require(orgId, priceListId);
    Item item = itemService.require(orgId, itemId);

    BigDecimal sellingPrice = price != null ? price : BigDecimal.ZERO;
    BigDecimal maxUnitCost =
        stockMovementRepository.findMaxUnitCostByOrgAndItem(orgId, itemId);
    if (maxUnitCost == null && item.getBuyingPrice() != null) {
      maxUnitCost = item.getBuyingPrice();
    }
    if (maxUnitCost == null) {
      throw new BadRequestException(
          "ITEM_NOT_SUPPLIED",
          MSG_NO_PURCHASE_HISTORY);
    }

    if (sellingPrice.compareTo(maxUnitCost) <= 0) {
      throw new BadRequestException(
          "SELLING_PRICE_BELOW_COST",
          "Selling price must be greater than buying price (cost: "
              + maxUnitCost
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
        priceListItemRepository.findByPriceListIdAndItemIdAndOrgId(
            priceListId, itemId, orgId);
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
      UUID orgId,
      UUID priceListId,
      UUID priceListItemId,
      BigDecimal price,
      String currency) {
    PriceListItem line = requireInPriceList(orgId, priceListId, priceListItemId);

    BigDecimal sellingPrice = price != null ? price : BigDecimal.ZERO;
    Item lineItem = line.getItem();
    BigDecimal maxUnitCost =
        stockMovementRepository.findMaxUnitCostByOrgAndItem(orgId, lineItem.getId());
    if (maxUnitCost == null && lineItem.getBuyingPrice() != null) {
      maxUnitCost = lineItem.getBuyingPrice();
    }
    if (maxUnitCost == null) {
      throw new BadRequestException(
          "ITEM_NOT_SUPPLIED",
          MSG_NO_PURCHASE_HISTORY);
    }

    if (sellingPrice.compareTo(maxUnitCost) <= 0) {
      throw new BadRequestException(
          "SELLING_PRICE_BELOW_COST",
          "Selling price must be greater than buying price (cost: "
              + maxUnitCost
              + "). Reduce cost or increase selling price.");
    }

    line.setPrice(sellingPrice);
    line.setCurrency(
        currency != null && !currency.isBlank() ? currency : DEFAULT_CURRENCY);
    return priceListItemRepository.save(line);
  }

  @Override
  @Transactional(readOnly = true)
  public List<PriceListItem> listByPriceList(UUID orgId, UUID priceListId) {
    priceListService.require(orgId, priceListId);
    return priceListItemRepository.findAllByPriceListIdAndOrgId(priceListId, orgId);
  }

  @Override
  @Transactional(readOnly = true)
  public Page<PriceListItem> listByPriceList(
      UUID orgId, UUID priceListId, Pageable pageable) {
    priceListService.require(orgId, priceListId);
    return priceListItemRepository.findByPriceListIdAndOrgId(priceListId, orgId, pageable);
  }

  @Override
  @Transactional
  public void remove(UUID orgId, UUID priceListId, UUID priceListItemId) {
    PriceListItem line = requireInPriceList(orgId, priceListId, priceListItemId);
    priceListItemRepository.delete(line);
  }
}
