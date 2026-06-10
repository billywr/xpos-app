package com.blinc.xpos.api.v1.admin.assistant;

import com.blinc.xpos.config.AssistantProperties;
import com.blinc.xpos.modules.assistant.service.AssistantUsageService;
import com.blinc.xpos.modules.organization.service.OrgService;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/assistant")
public class AssistantAdminController {

  private final AssistantUsageService usageService;
  private final OrgService orgService;
  private final AssistantProperties assistantProperties;

  public AssistantAdminController(
      AssistantUsageService usageService,
      OrgService orgService,
      AssistantProperties assistantProperties) {
    this.usageService = Objects.requireNonNull(usageService, "usageService");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.assistantProperties = Objects.requireNonNull(assistantProperties, "assistantProperties");
  }

  @GetMapping("/usage")
  public Map<String, Object> usage(
      @PathVariable UUID orgId, @RequestParam(defaultValue = "7") int days) {
    orgService.require(orgId);
    int clampedDays = Math.max(1, Math.min(days, 90));
    return usageService.getUsageSummary(orgId, clampedDays);
  }

  @GetMapping("/settings")
  public Map<String, Object> settings(@PathVariable UUID orgId) {
    orgService.require(orgId);
    AssistantProperties.Llm llm = assistantProperties.getLlm();
    return Map.of(
        "llmConfigured", llm.isConfigured(),
        "llmEnabled", llm.isEnabled(),
        "model", llm.getModel(),
        "maxTokensPerDayPerOrg", llm.getMaxTokensPerDayPerOrg(),
        "rateLimitPerHour", assistantProperties.getRateLimitPerHour());
  }
}
