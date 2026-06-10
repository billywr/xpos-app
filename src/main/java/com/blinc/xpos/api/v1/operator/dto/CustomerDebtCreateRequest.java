package com.blinc.xpos.api.v1.operator.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record CustomerDebtCreateRequest(
    @NotNull(message = "Customer is required") UUID customerId,
    @NotNull(message = "Amount is required")
        @DecimalMin(value = "0.01", message = "Amount must be positive")
        BigDecimal amount,
    LocalDate dueDate,
    String notes,
    UUID saleId,
    UUID terminalId,
    UUID shiftId,
    Instant createdAt,
    @Size(max = 255, message = "Issued by is too long") String issuedBy) {}
