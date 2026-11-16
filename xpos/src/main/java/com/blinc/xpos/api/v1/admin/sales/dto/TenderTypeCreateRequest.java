package com.blinc.xpos.api.v1.admin.sales.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TenderTypeCreateRequest(
    @NotBlank(message = "Code is required") @Size(max = 50) String code,
    @NotBlank(message = "Name is required") @Size(max = 100) String name) {}
