package com.blinc.xpos.modules.pricing.service;

import com.blinc.xpos.modules.pricing.domain.PriceList;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface PriceListService {

  PriceList create(
      UUID orgId, UUID branchId, String channel, String name, int priority, boolean active);

  PriceList require(UUID orgId, UUID priceListId);

  Page<PriceList> list(UUID orgId, Pageable pageable);

  PriceList update(
      UUID orgId,
      UUID priceListId,
      UUID branchId,
      String channel,
      String name,
      int priority,
      boolean active);

  void delete(UUID orgId, UUID priceListId);
}
