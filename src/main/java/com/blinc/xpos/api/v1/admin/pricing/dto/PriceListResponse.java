package com.blinc.xpos.api.v1.admin.pricing.dto;

import java.time.Instant;
import java.util.UUID;

public record PriceListResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    String channel,
    String name,
    int priority,
    boolean active,
    Instant createdAt,
    Instant updatedAt) {}
