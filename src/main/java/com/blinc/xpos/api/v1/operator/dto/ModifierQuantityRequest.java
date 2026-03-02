package com.blinc.xpos.api.v1.operator.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record ModifierQuantityRequest(
    @NotNull(message = "Modifier option ID is required") UUID modifierOptionId,
    @NotNull(message = "Quantity is required") @DecimalMin(value = "0.001", message = "Quantity must be positive")
        BigDecimal qty) {}
