package com.blinc.xpos.api.v1.admin.pricing.dto;

import com.blinc.xpos.common.constants.enums.VatCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record TaxProfileCreateRequest(
    @NotBlank(message = "Name is required") String name,
    @NotNull(message = "VAT category is required") VatCategory vatCategory,
    BigDecimal serviceChargeRate,
    BigDecimal levyRate) {}
