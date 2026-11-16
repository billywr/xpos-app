package com.blinc.xpos.modules.assistant;

import com.blinc.xpos.config.AssistantProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Optional LLM orchestration: classify intent and extract period hints when keyword router fails.
 */
@Component
public class AssistantLlmOrchestrator {

  private static final Logger LOG = LoggerFactory.getLogger(AssistantLlmOrchestrator.class);

  private static final String SYSTEM_PROMPT =
      """
      Classify POS operator questions. Reply ONLY with JSON:
      {"intent":"LABEL","periodHint":"today|this week|yesterday|this month|none"}
      Labels: SALES_TODAY, TOP_ITEMS, TOP_DRINKS, LOW_STOCK, STOCK_VARIANCE, CATALOG_COUNT, OPEN_SHIFT,
      DEBT_SUMMARY, TOP_DEBTORS, OVERDUE_DEBTS, EXPENSES_TODAY, SHIFT_VARIANCE, PAYMENT_MIX,
      COMPARE_PERIODS, DAY_CLOSE_STATUS, EXPLAIN_ERROR, SUPPORT_BUNDLE, SESSION_CONTEXT, HELP, UNKNOWN
      """;

  private final AssistantProperties properties;
  private final AssistantLlmBudgetGuard budgetGuard;
  private final ObjectMapper objectMapper;
  private final HttpClient httpClient;

  public AssistantLlmOrchestrator(
      AssistantProperties properties,
      AssistantLlmBudgetGuard budgetGuard,
      ObjectMapper objectMapper) {
    this.properties = Objects.requireNonNull(properties, "properties");
    this.budgetGuard = Objects.requireNonNull(budgetGuard, "budgetGuard");
    this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
    this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
  }

  public AssistantLlmBudgetGuard.LlmRouteResult classify(UUID orgId, String message) {
    if (!budgetGuard.canUseLlm(orgId)) {
      return new AssistantLlmBudgetGuard.LlmRouteResult(AssistantIntent.UNKNOWN, 0, false);
    }
    try {
      ObjectNode requestBody = objectMapper.createObjectNode();
      requestBody.put("model", properties.getLlm().getModel());
      requestBody.set(
          "messages",
          objectMapper
              .createArrayNode()
              .add(
                  objectMapper
                      .createObjectNode()
                      .put("role", "system")
                      .put("content", SYSTEM_PROMPT))
              .add(objectMapper.createObjectNode().put("role", "user").put("content", message)));
      requestBody.put("max_tokens", 60);
      requestBody.put("temperature", 0);
      requestBody.put(
          "response_format", objectMapper.createObjectNode().put("type", "json_object"));

      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(properties.getLlm().getBaseUrl() + "/chat/completions"))
              .timeout(Duration.ofSeconds(15))
              .header("Authorization", "Bearer " + properties.getLlm().getApiKey())
              .header("Content-Type", "application/json")
              .POST(HttpRequest.BodyPublishers.ofString(requestBody.toString()))
              .build();

      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        LOG.warn("Assistant LLM orchestrator failed: HTTP {}", response.statusCode());
        return new AssistantLlmBudgetGuard.LlmRouteResult(AssistantIntent.UNKNOWN, 0, false);
      }
      JsonNode root = objectMapper.readTree(response.body());
      int tokens = root.path("usage").path("total_tokens").asInt(50);
      String content = root.path("choices").path(0).path("message").path("content").asText("{}");
      JsonNode parsed = objectMapper.readTree(content);
      AssistantIntent intent = parseIntent(parsed.path("intent").asText(""));
      return new AssistantLlmBudgetGuard.LlmRouteResult(intent, tokens, true);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return new AssistantLlmBudgetGuard.LlmRouteResult(AssistantIntent.UNKNOWN, 0, false);
    } catch (Exception e) {
      LOG.warn("Assistant LLM orchestrator error: {}", e.getMessage());
      return new AssistantLlmBudgetGuard.LlmRouteResult(AssistantIntent.UNKNOWN, 0, false);
    }
  }

  private static AssistantIntent parseIntent(String label) {
    if (label == null || label.isBlank()) {
      return AssistantIntent.UNKNOWN;
    }
    String normalized = label.toUpperCase(Locale.ROOT).replaceAll("[^A-Z_]", "");
    try {
      return AssistantIntent.valueOf(normalized);
    } catch (IllegalArgumentException ex) {
      return AssistantIntent.UNKNOWN;
    }
  }
}
