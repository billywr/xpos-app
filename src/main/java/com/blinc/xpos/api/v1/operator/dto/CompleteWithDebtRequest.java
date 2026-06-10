package com.blinc.xpos.api.v1.operator.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * Request body for completing a sale with partial payment when the remaining balance is recorded as
 * customer debt.
 */
public record CompleteWithDebtRequest(
    @NotBlank(message = "Customer name is required") String customerName,
    String customerPhone,
    LocalDate dueDate,
    @Size(max = 255, message = "Issued by is too long") String issuedBy) {}
