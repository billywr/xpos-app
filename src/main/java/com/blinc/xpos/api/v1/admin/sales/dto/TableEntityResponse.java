package com.blinc.xpos.api.v1.admin.sales.dto;

import java.time.Instant;
import java.util.UUID;

public record TableEntityResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    UUID tableAreaId,
    String name,
    Integer capacity,
    String status,
    Instant createdAt) {}
