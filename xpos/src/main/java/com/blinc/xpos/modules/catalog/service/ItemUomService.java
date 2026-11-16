package com.blinc.xpos.modules.catalog.service;

import com.blinc.xpos.modules.catalog.domain.ItemUom;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public interface ItemUomService {

  ItemUom add(UUID orgId, UUID itemId, UUID uomId, BigDecimal conversionToBase);

  ItemUom requireInItem(UUID orgId, UUID itemId, UUID itemUomId);

  List<ItemUom> listByItem(UUID orgId, UUID itemId);

  void remove(UUID orgId, UUID itemId, UUID itemUomId);
}
