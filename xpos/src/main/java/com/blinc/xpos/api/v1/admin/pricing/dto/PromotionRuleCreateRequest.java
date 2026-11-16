package com.blinc.xpos.api.v1.admin.pricing.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record PromotionRuleCreateRequest(
    UUID branchId,
    @NotBlank(message = "Name is required") String name,
    @NotBlank(message = "Rule type is required") String ruleType,
    @NotBlank(message = "Conditions JSON is required") String conditionsJson,
    @NotBlank(message = "Actions JSON is required") String actionsJson,
    int priority,
    boolean active) {}
