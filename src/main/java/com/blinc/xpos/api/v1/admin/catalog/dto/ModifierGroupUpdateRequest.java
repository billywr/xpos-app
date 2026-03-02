package com.blinc.xpos.api.v1.admin.catalog.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record ModifierGroupUpdateRequest(
    @NotBlank(message = "Name is required") String name,
    @Min(0) @Max(99) int minSelect,
    @Min(0) @Max(99) int maxSelect,
    boolean required) {}
