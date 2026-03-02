package com.blinc.xpos.modules.pricing.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.service.ItemService;
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
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PriceListItemServiceImpl implements PriceListItemService {

  private static final String DEFAULT_CURRENCY = "KES";

  private final PriceListItemRepository priceListItemRepository;
  private final PriceListService priceListService;
  private final ItemService itemService;
  private final Clock clock;

  public PriceListItemServiceImpl(
      PriceListItemRepository priceListItemRepository,
      PriceListService priceListService,
      ItemService itemService,
      Clock clock) {
    this.priceListItemRepository =
        Objects.requireNonNull(priceListItemRepository, "priceListItemRepository");
    this.priceListService = Objects.requireNonNull(priceListService, "priceListService");
    this.itemService = Objects.requireNonNull(itemService, "itemService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public PriceListItem add(
      UUID orgId, UUID priceListId, UUID itemId, BigDecimal price, String currency) {
    PriceList priceList = priceListService.require(orgId, priceListId);
    Item item = itemService.require(orgId, itemId);
    PriceListItem line = new PriceListItem();
    line.setOrg(priceList.getOrg());
    line.setPriceList(priceList);
    line.setItem(item);
    line.setPrice(price != null ? price : BigDecimal.ZERO);
    line.setCurrency(currency != null && !currency.isBlank() ? currency : DEFAULT_CURRENCY);
    line.setCreatedAt(Instant.now(clock));
    return priceListItemRepository.save(line);
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
  @Transactional(readOnly = true)
  public List<PriceListItem> listByPriceList(UUID orgId, UUID priceListId) {
    priceListService.require(orgId, priceListId);
    return priceListItemRepository.findAllByPriceListIdAndOrgId(priceListId, orgId);
  }

  @Override
  @Transactional
  public void remove(UUID orgId, UUID priceListId, UUID priceListItemId) {
    PriceListItem line = requireInPriceList(orgId, priceListId, priceListItemId);
    priceListItemRepository.delete(line);
  }
}
