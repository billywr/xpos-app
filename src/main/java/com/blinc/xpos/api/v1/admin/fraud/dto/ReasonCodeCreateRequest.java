package com.blinc.xpos.api.v1.admin.fraud.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReasonCodeCreateRequest(
    @NotBlank(message = "Code is required") @Size(max = 50) String code,
    @NotBlank(message = "Description is required") @Size(max = 500) String description) {}
