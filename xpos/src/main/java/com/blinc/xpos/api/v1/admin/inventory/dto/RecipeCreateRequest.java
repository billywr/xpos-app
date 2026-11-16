package com.blinc.xpos.api.v1.admin.inventory.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record RecipeCreateRequest(
    @NotNull(message = "Menu item ID is required") UUID menuItemId,
    @NotNull(message = "Yield quantity is required") @DecimalMin(value = "0.001")
        BigDecimal yieldQty) {}
