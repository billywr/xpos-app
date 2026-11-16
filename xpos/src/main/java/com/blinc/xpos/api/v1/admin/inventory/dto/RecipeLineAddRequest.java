package com.blinc.xpos.api.v1.admin.inventory.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record RecipeLineAddRequest(
    @NotNull(message = "Ingredient item ID is required") UUID ingredientItemId,
    @NotNull(message = "Quantity is required") @DecimalMin(value = "0.001") BigDecimal qty,
    UUID uomId) {}
