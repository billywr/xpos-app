package com.blinc.xpos.api.v1.admin.compliance.dto;

import jakarta.validation.constraints.NotNull;
import java.util.Map;
import java.util.UUID;

public record VscuConfigCreateRequest(
    @NotNull(message = "Branch ID is required") UUID branchId,
    @NotNull(message = "configJson is required") Map<String, Object> configJson) {}
