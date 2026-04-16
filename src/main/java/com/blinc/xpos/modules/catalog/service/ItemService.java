package com.blinc.xpos.modules.catalog.service;

import com.blinc.xpos.common.constants.enums.ItemType;
import com.blinc.xpos.modules.catalog.domain.Item;
import java.math.BigDecimal;
import java.util.List;
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
      boolean active,
      BigDecimal buyingPrice,
      BigDecimal defaultSellingPrice,
      Boolean visibleInPos);

  Item require(UUID orgId, UUID itemId);

  /**
   * Same as {@link #require} but rejects soft-deleted (inactive) catalog items. Use for stock,
   * sales, transfers, purchase orders, pricing, and barcode lookup at POS.
   */
  Item requireActive(UUID orgId, UUID itemId);

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
      boolean active,
      BigDecimal buyingPrice,
      BigDecimal defaultSellingPrice,
      Boolean visibleInPos);

  void delete(UUID orgId, UUID itemId);

  /** Returns IDs of active items that have a non-null defaultSellingPrice. */
  List<UUID> findItemIdsWithSellingPrice(UUID orgId);
}
