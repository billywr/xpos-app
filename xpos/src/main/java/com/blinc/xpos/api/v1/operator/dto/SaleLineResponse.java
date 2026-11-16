package com.blinc.xpos.api.v1.operator.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SaleLineResponse(
    UUID id,
    UUID saleId,
    UUID itemId,
    String itemName,
    BigDecimal qty,
    UUID uomId,
    BigDecimal unitPrice,
    BigDecimal lineSubtotal,
    BigDecimal lineTotal,
    Instant createdAt,
    List<SaleLineModifierResponse> modifiers) {}
