package com.blinc.xpos.api.v1.admin.fraud.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ApprovalPolicyResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    String policyCode,
    BigDecimal thresholdValue,
    Boolean requiresManager,
    Instant createdAt,
    Instant updatedAt) {}
