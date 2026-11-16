package com.blinc.xpos.api.v1.admin.staff.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record StaffUserCreateRequest(
    @NotBlank(message = "iamUserId is required")
        @Size(max = 100, message = "iamUserId must be at most 100 characters")
        String iamUserId,
    @Size(max = 100, message = "username must be at most 100 characters") String username) {}
