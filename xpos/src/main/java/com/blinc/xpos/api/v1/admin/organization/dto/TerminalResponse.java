package com.blinc.xpos.api.v1.admin.organization.dto;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import java.time.Instant;
import java.util.UUID;

public record TerminalResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    String terminalCode,
    UUID deviceRegistrationId,
    UUID printerProfileId,
    StatusCommon status,
    Instant createdAt,
    Instant updatedAt) {}
