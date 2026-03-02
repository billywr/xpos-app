package com.blinc.xpos.api.v1.admin.catalog.dto;

import java.time.Instant;
import java.util.UUID;

public record ItemImageResponse(
    UUID id,
    UUID itemId,
    String url,
    int sortOrder,
    boolean isPrimary,
    Instant createdAt) {}
