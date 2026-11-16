package com.blinc.xpos.api.v1.admin.inventory.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record GrnLineResponse(
    UUID id,
    UUID grnId,
    UUID itemId,
    String itemName,
    String barcode,
    BigDecimal qty,
    UUID uomId,
    BigDecimal receivedUnitCost,
    Instant createdAt) {}
