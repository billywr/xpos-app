package com.blinc.xpos.modules.pricing.service;

import com.blinc.xpos.modules.pricing.domain.PriceListItem;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public interface PriceListItemService {

  PriceListItem add(
      UUID orgId, UUID priceListId, UUID itemId, BigDecimal price, String currency);

  PriceListItem requireInPriceList(UUID orgId, UUID priceListId, UUID priceListItemId);

  List<PriceListItem> listByPriceList(UUID orgId, UUID priceListId);

  void remove(UUID orgId, UUID priceListId, UUID priceListItemId);
}
