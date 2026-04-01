package com.blinc.xpos.api.v1.operator.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record CustomerDebtUpdateRequest(
    UUID customerId,
    @Size(max = 255, message = "Customer name is too long") String customerName,
    @Size(max = 64, message = "Customer phone is too long") String customerPhone,
    BigDecimal amount,
    @DecimalMin(value = "0", message = "Balance cannot be negative") BigDecimal outstanding,
    LocalDate dueDate,
    String notes) {}
