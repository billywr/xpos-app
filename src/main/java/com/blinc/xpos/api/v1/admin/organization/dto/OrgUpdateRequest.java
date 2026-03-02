package com.blinc.xpos.api.v1.admin.organization.dto;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import jakarta.validation.constraints.NotBlank;

public record OrgUpdateRequest(
    @NotBlank(message = "Organization name is required") String name, StatusCommon status) {}
