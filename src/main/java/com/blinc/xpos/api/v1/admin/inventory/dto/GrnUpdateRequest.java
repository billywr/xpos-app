package com.blinc.xpos.api.v1.admin.inventory.dto;

import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;

public record GrnUpdateRequest(
    @NotNull(message = "Supplier ID is required") UUID supplierId,
    @NotNull(message = "Received at is required") Instant receivedAt,
    Boolean active) {}
