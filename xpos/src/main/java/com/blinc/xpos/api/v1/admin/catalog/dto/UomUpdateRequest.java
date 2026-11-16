package com.blinc.xpos.api.v1.admin.catalog.dto;

import jakarta.validation.constraints.NotBlank;

public record UomUpdateRequest(
    @NotBlank(message = "Name is required") String name, String symbol) {}
