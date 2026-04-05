package com.blinc.xpos.api.v1.admin.organization.dto;

import jakarta.validation.constraints.NotBlank;

public record CustomerCreateRequest(
    @NotBlank(message = "Customer name is required") String name, String phone, String email) {}
