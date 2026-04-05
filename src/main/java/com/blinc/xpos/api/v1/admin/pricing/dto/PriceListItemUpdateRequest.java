package com.blinc.xpos.api.v1.admin.pricing.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record PriceListItemUpdateRequest(
    @NotNull @DecimalMin(value = "0", inclusive = true) BigDecimal price, String currency) {}
