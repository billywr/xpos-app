package com.blinc.xpos.api.v1.admin.inventory.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record GrnLineRequest(
    @NotNull(message = "Item ID is required") UUID itemId,
    @NotNull(message = "Quantity is required") @DecimalMin(value = "0.001") BigDecimal qty,
    UUID uomId,
    BigDecimal receivedUnitCost) {}
