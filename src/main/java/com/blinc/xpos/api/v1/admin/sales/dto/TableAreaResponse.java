package com.blinc.xpos.api.v1.admin.sales.dto;

import java.time.Instant;
import java.util.UUID;

public record TableAreaResponse(
    UUID id, UUID orgId, UUID branchId, String name, Instant createdAt) {}
