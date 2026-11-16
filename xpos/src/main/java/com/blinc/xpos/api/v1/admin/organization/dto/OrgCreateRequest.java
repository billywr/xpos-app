package com.blinc.xpos.api.v1.admin.organization.dto;

import jakarta.validation.constraints.NotBlank;

public record OrgCreateRequest(@NotBlank(message = "Organization name is required") String name) {}
