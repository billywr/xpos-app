package com.blinc.xpos.api.v1.operator.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record MiscExpenseUpdateRequest(
    @NotNull(message = "Amount is required")
        @DecimalMin(value = "0.01", message = "Amount must be positive")
        BigDecimal amount,
    @NotBlank(message = "Category is required") @Size(max = 100) String category,
    @NotBlank(message = "Description is required") String description,
    String incurredBy,
    String receiptRef) {}
