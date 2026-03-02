package com.blinc.xpos.modules.pricing.service;

import com.blinc.xpos.modules.pricing.domain.PromotionRule;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface PromotionRuleService {

  PromotionRule create(
      UUID orgId,
      UUID branchId,
      String name,
      String ruleType,
      JsonNode conditionsJson,
      JsonNode actionsJson,
      int priority,
      boolean active);

  PromotionRule require(UUID orgId, UUID promotionRuleId);

  Page<PromotionRule> list(UUID orgId, Pageable pageable);

  PromotionRule update(
      UUID orgId,
      UUID promotionRuleId,
      UUID branchId,
      String name,
      String ruleType,
      JsonNode conditionsJson,
      JsonNode actionsJson,
      int priority,
      boolean active);
}
