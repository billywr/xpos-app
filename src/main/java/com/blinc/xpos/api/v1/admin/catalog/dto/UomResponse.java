package com.blinc.xpos.api.v1.admin.catalog.dto;

import java.time.Instant;
import java.util.UUID;

public record UomResponse(UUID id, UUID orgId, String name, String symbol, Instant createdAt) {}
