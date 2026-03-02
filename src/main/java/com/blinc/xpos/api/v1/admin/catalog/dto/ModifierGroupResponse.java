package com.blinc.xpos.api.v1.admin.catalog.dto;

import java.time.Instant;
import java.util.UUID;

public record ModifierGroupResponse(
    UUID id,
    UUID orgId,
    String name,
    int minSelect,
    int maxSelect,
    boolean required,
    Instant createdAt,
    Instant updatedAt) {}
