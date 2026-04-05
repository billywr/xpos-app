package com.blinc.xpos.api.v1.operator.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

/**
 * Request body for completing a sale with partial payment when the remaining balance is recorded as
 * customer debt.
 */
public record CompleteWithDebtRequest(
    @NotBlank(message = "Customer name is required") String customerName,
    String customerPhone,
    LocalDate dueDate) {}
