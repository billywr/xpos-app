package com.blinc.xpos.api.v1.admin.inventory.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record RecipeLineResponse(
    UUID id,
    UUID recipeId,
    UUID ingredientItemId,
    String ingredientItemName,
    BigDecimal qty,
    UUID uomId,
    Instant createdAt) {}
