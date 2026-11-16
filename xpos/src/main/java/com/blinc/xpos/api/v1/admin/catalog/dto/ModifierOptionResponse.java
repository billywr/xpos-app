package com.blinc.xpos.api.v1.admin.catalog.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ModifierOptionResponse(
    UUID id,
    UUID orgId,
    UUID modifierGroupId,
    String name,
    BigDecimal priceDelta,
    UUID itemId,
    Instant createdAt) {}
