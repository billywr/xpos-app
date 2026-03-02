package com.blinc.xpos.api.v1.admin.inventory.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record StockCountLineAddRequest(
    @NotNull(message = "Item ID is required") UUID itemId,
    @NotNull(message = "Counted quantity is required")
        @DecimalMin(value = "0", message = "Counted quantity must be non-negative")
        BigDecimal countedQty) {}
