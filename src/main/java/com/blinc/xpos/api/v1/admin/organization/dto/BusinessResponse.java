package com.blinc.xpos.api.v1.admin.organization.dto;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import java.time.Instant;
import java.util.UUID;

public record BusinessResponse(
    UUID id,
    UUID orgId,
    String legalName,
    String kraPin,
    String logoUrl,
    String receiptFooter,
    StatusCommon status,
    Instant createdAt,
    Instant updatedAt) {}
