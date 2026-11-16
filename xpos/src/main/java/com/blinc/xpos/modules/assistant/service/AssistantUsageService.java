package com.blinc.xpos.modules.assistant.service;

import com.blinc.xpos.modules.assistant.domain.AssistantQueryLog;
import com.blinc.xpos.modules.assistant.dto.AssistantCitation;
import com.blinc.xpos.modules.assistant.dto.AssistantQueryResponse;
import com.blinc.xpos.modules.assistant.repository.AssistantQueryLogRepository;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.repository.BranchRepository;
import com.blinc.xpos.modules.organization.repository.OrgRepository;
import com.blinc.xpos.modules.organization.repository.StaffUserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AssistantUsageService {

  private final AssistantQueryLogRepository queryLogRepository;
  private final OrgRepository orgRepository;
  private final BranchRepository branchRepository;
  private final StaffUserRepository staffUserRepository;
  private final Clock clock;

  public AssistantUsageService(
      AssistantQueryLogRepository queryLogRepository,
      OrgRepository orgRepository,
      BranchRepository branchRepository,
      StaffUserRepository staffUserRepository,
      Clock clock) {
    this.queryLogRepository = Objects.requireNonNull(queryLogRepository, "queryLogRepository");
    this.orgRepository = Objects.requireNonNull(orgRepository, "orgRepository");
    this.branchRepository = Objects.requireNonNull(branchRepository, "branchRepository");
    this.staffUserRepository = Objects.requireNonNull(staffUserRepository, "staffUserRepository");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Transactional
  public void logQuery(
      UUID orgId,
      UUID branchId,
      UUID staffUserId,
      String requestId,
      String intent,
      String messagePreview,
      boolean llmUsed,
      int llmTokens,
      long latencyMs,
      boolean success) {
    Org org = orgRepository.getReferenceById(orgId);
    AssistantQueryLog log = new AssistantQueryLog();
    log.setOrg(org);
    if (branchId != null) {
      log.setBranch(branchRepository.getReferenceById(branchId));
    }
    if (staffUserId != null) {
      log.setStaffUser(staffUserRepository.getReferenceById(staffUserId));
    }
    log.setRequestId(requestId);
    log.setIntent(intent);
    log.setMessagePreview(messagePreview);
    log.setLlmUsed(llmUsed);
    log.setLlmTokens(llmTokens);
    log.setLatencyMs(latencyMs);
    log.setSuccess(success);
    log.setCreatedAt(clock.instant());
    queryLogRepository.save(log);
  }

  public AssistantQueryResponse finalizeResponse(
      AssistantQueryResponse response,
      String toolName,
      String requestId,
      boolean llmUsed,
      long latencyMs) {
    List<AssistantCitation> citations = response.citations();
    if (citations == null || citations.isEmpty()) {
      citations =
          List.of(
              new AssistantCitation(
                  toolName,
                  requestId,
                  response.dataAsOf() != null ? response.dataAsOf() : clock.instant()));
    }
    return new AssistantQueryResponse(
        response.answer(),
        response.intent(),
        response.suggestions(),
        response.data(),
        citations,
        requestId,
        response.dataAsOf() != null ? response.dataAsOf() : clock.instant(),
        llmUsed,
        latencyMs);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> getUsageSummary(UUID orgId, int days) {
    Instant to = clock.instant();
    Instant from = to.minus(days, ChronoUnit.DAYS);
    long totalQueries =
        queryLogRepository
            .findByOrgIdAndCreatedAtBetween(orgId, from, to, PageRequest.of(0, 1))
            .getTotalElements();
    long llmTokens = queryLogRepository.sumLlmTokensSince(orgId, from, to);
    List<Object[]> intentCounts = queryLogRepository.countByIntentSince(orgId, from, to);
    List<Map<String, Object>> topIntents = new ArrayList<>();
    for (Object[] row : intentCounts) {
      topIntents.add(Map.of("intent", row[0], "count", row[1]));
    }
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("days", days);
    summary.put("totalQueries", totalQueries);
    summary.put("llmTokensUsed", llmTokens);
    summary.put("topIntents", topIntents);
    return summary;
  }
}
