package com.blinc.xpos.api.v1.admin.staff.dto;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import jakarta.validation.constraints.NotNull;

public record StaffUserStatusUpdateRequest(
    @NotNull(message = "status is required") StatusCommon status) {}
