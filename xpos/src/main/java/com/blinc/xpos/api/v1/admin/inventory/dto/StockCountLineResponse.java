package com.blinc.xpos.api.v1.admin.inventory.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record StockCountLineResponse(
    UUID id,
    UUID sessionId,
    UUID itemId,
    String itemName,
    BigDecimal countedQty,
    BigDecimal systemQty,
    BigDecimal varianceQty,
    BigDecimal unitCost,
    BigDecimal qtySold,
    BigDecimal sellingPrice,
    Instant createdAt) {}
