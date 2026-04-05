package com.blinc.xpos.api.v1.admin.inventory.dto;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * One line in the inventory report: item with on-hand, sold, reserved, and initial received
 * quantities.
 */
public record InventoryReportLineResponse(
    UUID itemId,
    String itemName,
    String sku,
    BigDecimal onHandQty,
    BigDecimal soldQty,
    BigDecimal reservedQty,
    BigDecimal receivedQty,
    Boolean trackInventory) {}
