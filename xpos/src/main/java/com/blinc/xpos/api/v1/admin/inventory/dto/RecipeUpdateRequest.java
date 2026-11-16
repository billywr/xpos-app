package com.blinc.xpos.api.v1.admin.inventory.dto;

import jakarta.validation.constraints.DecimalMin;
import java.math.BigDecimal;

public record RecipeUpdateRequest(
    @DecimalMin(value = "0.001") BigDecimal yieldQty, Boolean active) {}
