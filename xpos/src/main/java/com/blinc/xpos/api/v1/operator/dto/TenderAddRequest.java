package com.blinc.xpos.api.v1.operator.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record TenderAddRequest(
    @NotNull(message = "Tender type ID is required") UUID tenderTypeId,
    @NotNull(message = "Amount is required")
        @DecimalMin(value = "0", message = "Amount must be non-negative")
        BigDecimal amount,
    String currency) {}
