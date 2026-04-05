package com.blinc.xpos.api.v1.admin.sales.dto;

import jakarta.validation.constraints.NotBlank;

public record TableAreaUpdateRequest(@NotBlank(message = "Name is required") String name) {}
