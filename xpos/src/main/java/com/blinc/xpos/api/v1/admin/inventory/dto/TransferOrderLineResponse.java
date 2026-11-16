package com.blinc.xpos.api.v1.admin.inventory.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TransferOrderLineResponse(
    UUID id,
    UUID transferOrderId,
    UUID itemId,
    String itemName,
    BigDecimal qty,
    UUID uomId,
    Instant createdAt) {}
