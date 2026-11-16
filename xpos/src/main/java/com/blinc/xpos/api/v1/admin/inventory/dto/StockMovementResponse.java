package com.blinc.xpos.api.v1.admin.inventory.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record StockMovementResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    UUID itemId,
    String itemName,
    String movementType,
    BigDecimal qty,
    UUID uomId,
    BigDecimal unitCost,
    String sourceType,
    UUID sourceId,
    UUID createdByStaffUserId,
    Instant createdAt) {}
