package com.blinc.xpos.modules.pricing.service;

import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.pricing.domain.PriceListItem;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface PriceListItemService {

  /**
   * Returns the cost floor for display: the higher of the max stock-movement unit cost and the
   * catalog buying price. Returns {@code null} when no purchase history or buying price exists.
   */
  BigDecimal resolveCostFloor(UUID orgId, Item item);

  PriceListItem add(UUID orgId, UUID priceListId, UUID itemId, BigDecimal price, String currency);

  /**
   * Ensures item is in the price list at the given price. Creates or updates the price list entry.
   */
  PriceListItem ensureInPriceList(
      UUID orgId, UUID priceListId, UUID itemId, BigDecimal price, String currency);

  /** Same as above but also sets the POS/menu visibility flag. */
  PriceListItem ensureInPriceList(
      UUID orgId,
      UUID priceListId,
      UUID itemId,
      BigDecimal price,
      String currency,
      boolean visibleInPos);

  PriceListItem update(
      UUID orgId, UUID priceListId, UUID priceListItemId, BigDecimal price, String currency);

  PriceListItem requireInPriceList(UUID orgId, UUID priceListId, UUID priceListItemId);

  List<PriceListItem> listByPriceList(UUID orgId, UUID priceListId);

  Page<PriceListItem> listByPriceList(UUID orgId, UUID priceListId, Pageable pageable);

  void remove(UUID orgId, UUID priceListId, UUID priceListItemId);

  /**
   * Deletes every price list row for the item (when the catalog item is hidden or soft-deleted).
   */
  void removeAllListItemsForItem(UUID orgId, UUID itemId);

  /**
   * Removes price list lines for a tracked item when it no longer has on-hand stock in the scope
   * implied by each price list (branch-scoped vs org-wide).
   */
  void purgePriceListLinesForTrackedItemIfOutOfStock(UUID orgId, UUID itemId);
}
