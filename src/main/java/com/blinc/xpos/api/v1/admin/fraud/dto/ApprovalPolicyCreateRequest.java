package com.blinc.xpos.api.v1.admin.fraud.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;

public record ApprovalPolicyCreateRequest(
    UUID branchId,
    @NotBlank(message = "Policy code is required") @Size(max = 100) String policyCode,
    BigDecimal thresholdValue,
    Boolean requiresManager) {}
