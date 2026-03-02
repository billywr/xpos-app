package com.blinc.xpos.api.v1.admin.catalog.dto;

import java.time.Instant;
import java.util.UUID;

public record CategoryResponse(
    UUID id,
    UUID orgId,
    UUID parentId,
    String name,
    String type,
    Instant createdAt,
    Instant updatedAt) {}
