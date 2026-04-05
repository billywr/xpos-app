package com.blinc.xpos.api.v1.operator.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record SaleLineAddRequest(
    @NotNull(message = "Item ID is required") UUID itemId,
    @NotNull(message = "Quantity is required")
        @DecimalMin(value = "0.001", message = "Quantity must be positive")
        BigDecimal qty,
    UUID uomId,
    BigDecimal unitPriceOverride,
    List<ModifierQuantityRequest> modifiers) {

  public SaleLineAddRequest {
    if (modifiers == null) {
      modifiers = List.of();
    }
  }
}
