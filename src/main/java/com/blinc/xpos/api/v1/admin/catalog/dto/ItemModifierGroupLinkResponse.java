package com.blinc.xpos.api.v1.admin.catalog.dto;

import java.time.Instant;
import java.util.UUID;

public record ItemModifierGroupLinkResponse(
    UUID id,
    UUID itemId,
    UUID modifierGroupId,
    Instant createdAt) {}
