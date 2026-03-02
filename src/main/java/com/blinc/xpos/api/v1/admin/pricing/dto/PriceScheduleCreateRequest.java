package com.blinc.xpos.api.v1.admin.pricing.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record PriceScheduleCreateRequest(
    @NotNull(message = "Branch is required") UUID branchId,
    @NotBlank(message = "Name is required") String name,
    @NotBlank(message = "Start time is required") String startsAt,
    @NotBlank(message = "End time is required") String endsAt,
    int daysOfWeek) {}
