package com.blinc.xpos.api.v1.admin.pricing.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record PriceListItemCreateRequest(
    @NotNull(message = "Item is required") UUID itemId,
    @NotNull(message = "Price is required") BigDecimal price,
    String currency) {}
