package com.blinc.xpos.modules.mpesa.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record MpesaStkInitiateRequest(
    @NotBlank(message = "phoneNumber is required") String phoneNumber,
    @NotNull(message = "amount is required")
        @DecimalMin(value = "0.01", message = "amount must be greater than zero")
        BigDecimal amount) {}
