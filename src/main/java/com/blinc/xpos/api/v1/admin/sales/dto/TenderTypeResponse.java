package com.blinc.xpos.api.v1.admin.sales.dto;

import java.time.Instant;
import java.util.UUID;

public record TenderTypeResponse(
    UUID id, UUID orgId, String code, String name, Boolean active, Instant createdAt) {}
