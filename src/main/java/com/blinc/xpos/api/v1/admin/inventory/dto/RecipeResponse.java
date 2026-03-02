package com.blinc.xpos.api.v1.admin.inventory.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record RecipeResponse(
    UUID id,
    UUID orgId,
    UUID menuItemId,
    String menuItemName,
    BigDecimal yieldQty,
    Boolean active,
    Instant createdAt,
    Instant updatedAt,
    List<RecipeLineResponse> lines) {}
