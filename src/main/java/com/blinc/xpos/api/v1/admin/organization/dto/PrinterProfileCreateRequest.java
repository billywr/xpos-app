package com.blinc.xpos.api.v1.admin.organization.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Map;

public record PrinterProfileCreateRequest(
    @NotBlank(message = "Name is required") String name,
    @NotNull(message = "Config JSON is required") Map<String, Object> configJson) {}
