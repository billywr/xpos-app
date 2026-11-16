package com.blinc.xpos.api.v1.admin.pricing.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record PriceListUpdateRequest(
    UUID branchId,
    String channel,
    @NotBlank(message = "Name is required") String name,
    int priority,
    boolean active) {}
