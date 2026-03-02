package com.blinc.xpos.api.v1.admin.sales.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record TableEntityCreateRequest(
    UUID tableAreaId,
    @NotBlank(message = "Name is required") String name,
    Integer capacity) {}
