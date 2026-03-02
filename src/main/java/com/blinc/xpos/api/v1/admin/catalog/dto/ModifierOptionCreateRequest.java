package com.blinc.xpos.api.v1.admin.catalog.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record ModifierOptionCreateRequest(
    @NotBlank(message = "Name is required") String name,
    @NotNull(message = "Price delta is required") BigDecimal priceDelta,
    UUID itemId) {}
