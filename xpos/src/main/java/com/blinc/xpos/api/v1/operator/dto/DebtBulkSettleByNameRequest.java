package com.blinc.xpos.api.v1.operator.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record DebtBulkSettleByNameRequest(
    @NotBlank(message = "Customer name is required") String customerName,
    @NotNull(message = "Payment amount is required")
        @DecimalMin(value = "0.01", message = "Payment amount must be positive")
        BigDecimal paymentAmount) {}
