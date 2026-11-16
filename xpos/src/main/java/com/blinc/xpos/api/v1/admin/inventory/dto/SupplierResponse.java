package com.blinc.xpos.api.v1.admin.inventory.dto;

import java.time.Instant;
import java.util.UUID;

public record SupplierResponse(
    UUID id,
    UUID orgId,
    String name,
    String phone,
    String email,
    Boolean active,
    Instant createdAt,
    Instant updatedAt) {}
