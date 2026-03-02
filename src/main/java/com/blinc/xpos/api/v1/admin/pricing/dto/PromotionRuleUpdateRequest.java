package com.blinc.xpos.api.v1.admin.pricing.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record PromotionRuleUpdateRequest(
    UUID branchId,
    @NotBlank(message = "Name is required") String name,
    @NotBlank(message = "Rule type is required") String ruleType,
    @NotNull(message = "Conditions JSON is required") String conditionsJson,
    @NotNull(message = "Actions JSON is required") String actionsJson,
    int priority,
    boolean active) {}
