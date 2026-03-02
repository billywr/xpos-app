package com.blinc.xpos.api.v1.admin.catalog.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ItemUomResponse(
    UUID id,
    UUID itemId,
    UUID uomId,
    BigDecimal conversionToBase,
    Instant createdAt) {}
