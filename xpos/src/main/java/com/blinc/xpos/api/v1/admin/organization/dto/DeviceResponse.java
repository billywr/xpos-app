package com.blinc.xpos.api.v1.admin.organization.dto;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import java.time.Instant;
import java.util.UUID;

public record DeviceResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    String deviceId,
    String deviceFingerprint,
    StatusCommon status,
    Instant lastSeenAt,
    Instant createdAt,
    Instant updatedAt) {}
