package com.blinc.xpos.api.v1.operator.dto;

import jakarta.validation.constraints.DecimalMin;
import java.math.BigDecimal;
import java.time.LocalDate;

public record CustomerDebtUpdateRequest(
    BigDecimal amount,
    @DecimalMin(value = "0", message = "Balance cannot be negative") BigDecimal outstanding,
    LocalDate dueDate,
    String notes) {}
