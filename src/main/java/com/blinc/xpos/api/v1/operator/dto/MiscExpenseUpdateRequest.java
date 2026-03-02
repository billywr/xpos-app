package com.blinc.xpos.api.v1.operator.dto;

import com.blinc.xpos.common.constants.enums.MiscExpenseCategory;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record MiscExpenseUpdateRequest(
    @NotNull(message = "Amount is required") @DecimalMin(value = "0.01", message = "Amount must be positive")
        BigDecimal amount,
    @NotNull(message = "Category is required") MiscExpenseCategory category,
    @NotBlank(message = "Description is required") String description,
    String incurredBy,
    String receiptRef) {}
