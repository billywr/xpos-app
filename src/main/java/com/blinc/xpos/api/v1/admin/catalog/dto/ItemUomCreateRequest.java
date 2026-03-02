package com.blinc.xpos.api.v1.admin.catalog.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record ItemUomCreateRequest(
    @NotNull(message = "UoM is required") UUID uomId,
    @NotNull(message = "Conversion to base is required") BigDecimal conversionToBase) {}
