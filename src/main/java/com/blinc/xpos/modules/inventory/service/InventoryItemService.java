package com.blinc.xpos.modules.inventory.service;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Manages per-branch inventory balances (on-hand qty). GRN increments; sales decrement. */
public interface InventoryItemService {

  /** Returns on-hand qty for (org, branch, item). Zero if no InventoryItem exists. */
  BigDecimal getOnHandQty(UUID orgId, UUID branchId, UUID itemId);

  /** Increments on-hand qty (e.g. on GRN). Creates InventoryItem if it does not exist. */
  void incrementOnHand(UUID orgId, UUID branchId, UUID itemId, BigDecimal qty);

  /** Decrements on-hand qty (e.g. on sale). Throws if insufficient stock. */
  void decrementOnHand(UUID orgId, UUID branchId, UUID itemId, BigDecimal qty);

  /**
   * Decrements on-hand when reversing a GRN line for an inactive (hidden) catalog item. Quantity is
   * subtracted but on-hand never goes below zero, so permanent receipt delete can succeed when
   * stock was already consumed.
   */
  void decrementOnHandClampToZeroForInactiveItem(
      UUID orgId, UUID branchId, UUID itemId, BigDecimal qty);

  /** Returns on-hand qty for each item in the given set. Missing items return 0. */
  Map<UUID, BigDecimal> getOnHandQtysByItemIds(UUID orgId, UUID branchId, Set<UUID> itemIds);

  /**
   * Applies stock take variance: adds delta to on-hand qty. Creates InventoryItem if needed. Delta
   * can be positive (overcount) or negative (undercount).
   */
  void applyStockTakeVariance(UUID orgId, UUID branchId, UUID itemId, BigDecimal varianceDelta);
}
