package com.blinc.xpos.api.v1.admin.organization.dto;

import java.time.Instant;
import java.util.UUID;

public record CustomerResponse(
    UUID id,
    String name,
    String phone,
    String email,
    Boolean active,
    Instant createdAt,
    Instant updatedAt) {}
