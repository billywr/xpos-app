package com.blinc.xpos.api.v1.admin.pricing.dto;

import com.blinc.xpos.common.constants.enums.VatCategory;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TaxProfileResponse(
    UUID id,
    UUID orgId,
    String name,
    VatCategory vatCategory,
    BigDecimal serviceChargeRate,
    BigDecimal levyRate,
    Instant createdAt,
    Instant updatedAt) {}
