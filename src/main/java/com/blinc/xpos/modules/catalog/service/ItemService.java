package com.blinc.xpos.modules.catalog.service;

import com.blinc.xpos.common.constants.enums.ItemType;
import com.blinc.xpos.modules.catalog.domain.Item;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ItemService {

  Item create(
      UUID orgId,
      String sku,
      String name,
      ItemType itemType,
      UUID categoryId,
      UUID baseUomId,
      UUID taxProfileId,
      boolean trackInventory,
      boolean active);

  Item require(UUID orgId, UUID itemId);

  Page<Item> list(UUID orgId, UUID categoryId, Pageable pageable);

  Item update(
      UUID orgId,
      UUID itemId,
      String sku,
      String name,
      ItemType itemType,
      UUID categoryId,
      UUID baseUomId,
      UUID taxProfileId,
      boolean trackInventory,
      boolean active);

  void delete(UUID orgId, UUID itemId);
}
