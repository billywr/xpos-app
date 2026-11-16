package com.blinc.xpos.modules.assistant;

import com.blinc.xpos.config.AssistantProperties;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Validates org-level LLM token budget before invoking the classifier. */
@Component
public class AssistantLlmBudgetGuard {

  private final AssistantProperties properties;
  private final com.blinc.xpos.modules.assistant.repository.AssistantQueryLogRepository
      queryLogRepository;
  private final Clock clock;

  public AssistantLlmBudgetGuard(
      AssistantProperties properties,
      com.blinc.xpos.modules.assistant.repository.AssistantQueryLogRepository queryLogRepository,
      Clock clock) {
    this.properties = Objects.requireNonNull(properties, "properties");
    this.queryLogRepository = Objects.requireNonNull(queryLogRepository, "queryLogRepository");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  public boolean canUseLlm(UUID orgId) {
    if (!properties.getLlm().isConfigured()) {
      return false;
    }
    int maxDaily = properties.getLlm().getMaxTokensPerDayPerOrg();
    if (maxDaily <= 0) {
      return true;
    }
    Instant startOfDay =
        clock
            .instant()
            .atZone(clock.getZone())
            .toLocalDate()
            .atStartOfDay(clock.getZone())
            .toInstant();
    long used = queryLogRepository.sumLlmTokensSince(orgId, startOfDay, clock.instant());
    return used < maxDaily;
  }

  public record LlmRouteResult(AssistantIntent intent, int tokensUsed, boolean llmUsed) {}

  public static String normalizeMessage(String message) {
    if (message == null) {
      return "";
    }
    return message.toLowerCase(Locale.ROOT).trim().replaceAll("\\s+", " ");
  }
}
