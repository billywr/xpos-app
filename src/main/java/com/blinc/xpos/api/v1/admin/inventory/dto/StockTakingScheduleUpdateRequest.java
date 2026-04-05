package com.blinc.xpos.api.v1.admin.inventory.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record StockTakingScheduleUpdateRequest(
    @NotNull(message = "Frequency is required")
        @Pattern(regexp = "DAILY|WEEKLY", message = "Frequency must be DAILY or WEEKLY")
        String frequency,
    @Min(0) @Max(6) Integer dayOfWeek,
    @Min(0) @Max(23) int scheduledHour,
    @Min(0) @Max(59) int scheduledMinute,
    boolean isActive) {}
