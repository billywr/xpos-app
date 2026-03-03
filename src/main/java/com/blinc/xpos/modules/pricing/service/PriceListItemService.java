package com.blinc.xpos.modules.pricing.service;

import com.blinc.xpos.modules.pricing.domain.PriceListItem;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface PriceListItemService {

  PriceListItem add(
      UUID orgId, UUID priceListId, UUID itemId, BigDecimal price, String currency);

  PriceListItem update(
      UUID orgId,
      UUID priceListId,
      UUID priceListItemId,
      BigDecimal price,
      String currency);

  PriceListItem requireInPriceList(UUID orgId, UUID priceListId, UUID priceListItemId);

  List<PriceListItem> listByPriceList(UUID orgId, UUID priceListId);

  Page<PriceListItem> listByPriceList(UUID orgId, UUID priceListId, Pageable pageable);

  void remove(UUID orgId, UUID priceListId, UUID priceListItemId);
}
