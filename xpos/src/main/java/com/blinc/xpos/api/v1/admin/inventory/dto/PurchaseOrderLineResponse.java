package com.blinc.xpos.api.v1.admin.inventory.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PurchaseOrderLineResponse(
    UUID id,
    UUID purchaseOrderId,
    UUID itemId,
    String itemName,
    BigDecimal qty,
    UUID uomId,
    BigDecimal expectedUnitCost,
    Instant createdAt) {}
