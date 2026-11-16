package com.blinc.xpos.api.v1.admin.fraud.dto;

import com.blinc.xpos.common.constants.enums.ApprovalType;
import java.time.Instant;
import java.util.UUID;

public record ApprovalEventResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    UUID approvedByStaffUserId,
    UUID requestedByStaffUserId,
    ApprovalType approvalType,
    String targetEntityType,
    UUID targetEntityId,
    UUID reasonCodeId,
    Instant approvedAt) {}
