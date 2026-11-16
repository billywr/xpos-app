package com.blinc.xpos.api.v1.admin.organization.dto;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import java.time.Instant;
import java.util.UUID;

public record OrgResponse(
    UUID id, String name, StatusCommon status, Instant createdAt, Instant updatedAt) {}
