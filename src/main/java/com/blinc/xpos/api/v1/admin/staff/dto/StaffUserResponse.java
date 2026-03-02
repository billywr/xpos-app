package com.blinc.xpos.api.v1.admin.staff.dto;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import java.time.Instant;
import java.util.UUID;

public record StaffUserResponse(
    UUID id,
    UUID orgId,
    String iamUserId,
    String username,
    StatusCommon status,
    Instant createdAt,
    Instant updatedAt) {}
