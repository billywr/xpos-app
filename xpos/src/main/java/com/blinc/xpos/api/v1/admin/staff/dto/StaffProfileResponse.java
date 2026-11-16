package com.blinc.xpos.api.v1.admin.staff.dto;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import java.time.Instant;
import java.util.UUID;

public record StaffProfileResponse(
    UUID id,
    UUID orgId,
    UUID staffUserId,
    String displayName,
    String phone,
    String email,
    String employeeNo,
    UUID defaultBranchId,
    StatusCommon status,
    Instant createdAt,
    Instant updatedAt) {}
