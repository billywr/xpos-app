package com.blinc.xpos.api.v1.admin.pricing;

import com.blinc.xpos.api.v1.admin.pricing.dto.PromotionRuleCreateRequest;
import com.blinc.xpos.api.v1.admin.pricing.dto.PromotionRuleResponse;
import com.blinc.xpos.api.v1.admin.pricing.dto.PromotionRuleUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.pricing.domain.PromotionRule;
import com.blinc.xpos.modules.pricing.service.PromotionRuleService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/promotion-rules")
public class PromotionRuleAdminController {

  private final PromotionRuleService promotionRuleService;
  private final PageRequestFactory pageRequestFactory;
  private final ObjectMapper objectMapper;

  public PromotionRuleAdminController(
      PromotionRuleService promotionRuleService,
      PageRequestFactory pageRequestFactory,
      ObjectMapper objectMapper) {
    this.promotionRuleService =
        Objects.requireNonNull(promotionRuleService, "promotionRuleService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
    this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public PromotionRuleResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody PromotionRuleCreateRequest request) {
    JsonNode conditions = parseJson(request.conditionsJson(), "conditionsJson");
    JsonNode actions = parseJson(request.actionsJson(), "actionsJson");
    PromotionRule rule =
        promotionRuleService.create(
            orgId,
            request.branchId(),
            request.name(),
            request.ruleType(),
            conditions,
            actions,
            request.priority(),
            request.active());
    return toResponse(rule);
  }

  @GetMapping
  public Page<PromotionRuleResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("priority").ascending());
    return promotionRuleService.list(orgId, normalized).map(this::toResponse);
  }

  @GetMapping("/{promotionRuleId}")
  public PromotionRuleResponse get(
      @PathVariable UUID orgId, @PathVariable UUID promotionRuleId) {
    return toResponse(promotionRuleService.require(orgId, promotionRuleId));
  }

  @PatchMapping("/{promotionRuleId}")
  public PromotionRuleResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID promotionRuleId,
      @Valid @RequestBody PromotionRuleUpdateRequest request) {
    JsonNode conditions = parseJson(request.conditionsJson(), "conditionsJson");
    JsonNode actions = parseJson(request.actionsJson(), "actionsJson");
    PromotionRule updated =
        promotionRuleService.update(
            orgId,
            promotionRuleId,
            request.branchId(),
            request.name(),
            request.ruleType(),
            conditions,
            actions,
            request.priority(),
            request.active());
    return toResponse(updated);
  }

  private JsonNode parseJson(String json, String fieldName) {
    if (json == null || json.isBlank()) {
      return objectMapper.createObjectNode();
    }
    try {
      return objectMapper.readTree(json);
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("Invalid JSON in " + fieldName + ": " + e.getMessage());
    }
  }

  private PromotionRuleResponse toResponse(PromotionRule rule) {
    return new PromotionRuleResponse(
        rule.getId(),
        rule.getOrg().getId(),
        rule.getBranch() != null ? rule.getBranch().getId() : null,
        rule.getName(),
        rule.getRuleType(),
        rule.getConditionsJson() != null ? rule.getConditionsJson().toString() : "{}",
        rule.getActionsJson() != null ? rule.getActionsJson().toString() : "{}",
        rule.getPriority(),
        rule.getActive(),
        rule.getCreatedAt(),
        rule.getUpdatedAt());
  }
}
