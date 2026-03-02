package com.blinc.xpos.modules.pricing.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.blinc.xpos.modules.pricing.domain.PromotionRule;
import com.blinc.xpos.modules.pricing.repository.PromotionRuleRepository;
import com.blinc.xpos.modules.pricing.service.PromotionRuleService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PromotionRuleServiceImpl implements PromotionRuleService {

  private final PromotionRuleRepository promotionRuleRepository;
  private final OrgService orgService;
  private final BranchService branchService;
  private final Clock clock;

  public PromotionRuleServiceImpl(
      PromotionRuleRepository promotionRuleRepository,
      OrgService orgService,
      BranchService branchService,
      Clock clock) {
    this.promotionRuleRepository =
        Objects.requireNonNull(promotionRuleRepository, "promotionRuleRepository");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public PromotionRule create(
      UUID orgId,
      UUID branchId,
      String name,
      String ruleType,
      JsonNode conditionsJson,
      JsonNode actionsJson,
      int priority,
      boolean active) {
    Org org = orgService.require(orgId);
    Branch branch = branchId != null ? branchService.require(orgId, branchId) : null;
    PromotionRule rule = new PromotionRule();
    rule.setOrg(org);
    rule.setBranch(branch);
    rule.setName(name);
    rule.setRuleType(ruleType);
    rule.setConditionsJson(
        conditionsJson != null ? conditionsJson : JsonNodeFactory.instance.objectNode());
    rule.setActionsJson(
        actionsJson != null ? actionsJson : JsonNodeFactory.instance.objectNode());
    rule.setPriority(priority);
    rule.setActive(active);
    Instant now = Instant.now(clock);
    rule.setCreatedAt(now);
    rule.setUpdatedAt(now);
    return promotionRuleRepository.save(rule);
  }

  @Override
  @Transactional(readOnly = true)
  public PromotionRule require(UUID orgId, UUID promotionRuleId) {
    return promotionRuleRepository
        .findByIdAndOrgId(promotionRuleId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "PROMOTION_RULE_NOT_FOUND", "Promotion rule not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<PromotionRule> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return promotionRuleRepository.findAllByOrgId(orgId, pageable);
  }

  @Override
  @Transactional
  public PromotionRule update(
      UUID orgId,
      UUID promotionRuleId,
      UUID branchId,
      String name,
      String ruleType,
      JsonNode conditionsJson,
      JsonNode actionsJson,
      int priority,
      boolean active) {
    PromotionRule rule = require(orgId, promotionRuleId);
    rule.setBranch(branchId != null ? branchService.require(orgId, branchId) : null);
    rule.setName(name);
    rule.setRuleType(ruleType);
    if (conditionsJson != null) {
      rule.setConditionsJson(conditionsJson);
    }
    if (actionsJson != null) {
      rule.setActionsJson(actionsJson);
    }
    rule.setPriority(priority);
    rule.setActive(active);
    rule.setUpdatedAt(Instant.now(clock));
    return promotionRuleRepository.save(rule);
  }
}
