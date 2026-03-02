package com.blinc.xpos.api.v1.me.dto;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import java.util.UUID;

public record MeStaffProfileResponse(
    String displayName,
    String phone,
    String email,
    String employeeNo,
    UUID defaultBranchId,
    StatusCommon status) {}
