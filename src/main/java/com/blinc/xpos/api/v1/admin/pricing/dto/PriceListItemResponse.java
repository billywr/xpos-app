package com.blinc.xpos.api.v1.admin.pricing.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PriceListItemResponse(
    UUID id,
    UUID priceListId,
    UUID itemId,
    String itemName,
    BigDecimal price,
    BigDecimal buyingPrice,
    String currency,
    Instant createdAt) {}
