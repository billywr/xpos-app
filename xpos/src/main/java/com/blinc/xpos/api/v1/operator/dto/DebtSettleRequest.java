package com.blinc.xpos.api.v1.operator.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record DebtSettleRequest(
    @NotNull(message = "Payment amount is required")
        @DecimalMin(value = "0.01", message = "Payment amount must be positive")
        BigDecimal paymentAmount) {}
