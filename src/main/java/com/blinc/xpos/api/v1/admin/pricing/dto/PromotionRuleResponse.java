package com.blinc.xpos.api.v1.admin.pricing.dto;

import java.time.Instant;
import java.util.UUID;

public record PromotionRuleResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    String name,
    String ruleType,
    String conditionsJson,
    String actionsJson,
    int priority,
    boolean active,
    Instant createdAt,
    Instant updatedAt) {}
