package com.blinc.xpos.api.v1.admin.fraud.dto;

import java.time.Instant;
import java.util.UUID;

public record ReasonCodeResponse(
    UUID id, UUID orgId, String code, String description, Boolean active, Instant createdAt) {}
