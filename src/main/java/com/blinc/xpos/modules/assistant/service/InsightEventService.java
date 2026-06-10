package com.blinc.xpos.modules.assistant.service;

import com.blinc.xpos.modules.assistant.InsightType;
import com.blinc.xpos.modules.assistant.domain.InsightEvent;
import com.blinc.xpos.modules.assistant.dto.InsightEventResponse;
import com.blinc.xpos.modules.assistant.repository.InsightEventRepository;
import com.blinc.xpos.modules.organization.repository.BranchRepository;
import com.blinc.xpos.modules.organization.repository.OrgRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Clock;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InsightEventService {

  private final InsightEventRepository insightEventRepository;
  private final OrgRepository orgRepository;
  private final BranchRepository branchRepository;
  private final ObjectMapper objectMapper;
  private final Clock clock;

  public InsightEventService(
      InsightEventRepository insightEventRepository,
      OrgRepository orgRepository,
      BranchRepository branchRepository,
      ObjectMapper objectMapper,
      Clock clock) {
    this.insightEventRepository =
        Objects.requireNonNull(insightEventRepository, "insightEventRepository");
    this.orgRepository = Objects.requireNonNull(orgRepository, "orgRepository");
    this.branchRepository = Objects.requireNonNull(branchRepository, "branchRepository");
    this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Transactional
  public InsightEvent create(
      UUID orgId,
      UUID branchId,
      InsightType type,
      String severity,
      String title,
      String body,
      ObjectNode data) {
    if (hasUnacknowledgedType(orgId, branchId, type.name())) {
      return null;
    }
    InsightEvent event = new InsightEvent();
    event.setOrg(orgRepository.getReferenceById(orgId));
    if (branchId != null) {
      event.setBranch(branchRepository.getReferenceById(branchId));
    }
    event.setInsightType(type.name());
    event.setSeverity(severity);
    event.setTitle(title);
    event.setBody(body);
    event.setDataJson(data);
    event.setCreatedAt(clock.instant());
    return insightEventRepository.save(event);
  }

  @Transactional(readOnly = true)
  public Page<InsightEventResponse> listUnacknowledged(
      UUID orgId, UUID branchId, Pageable pageable) {
    return insightEventRepository
        .findUnacknowledgedByOrgAndBranch(orgId, branchId, pageable)
        .map(this::toResponse);
  }

  @Transactional(readOnly = true)
  public long countUnacknowledged(UUID orgId, UUID branchId) {
    return insightEventRepository.countUnacknowledgedByOrgAndBranch(orgId, branchId);
  }

  @Transactional
  public InsightEventResponse acknowledge(UUID orgId, UUID eventId) {
    InsightEvent event =
        insightEventRepository
            .findByIdAndOrgId(eventId, orgId)
            .orElseThrow(
                () ->
                    new com.blinc.xpos.common.error.NotFoundException(
                        "INSIGHT_NOT_FOUND", "Insight event not found."));
    event.setAcknowledgedAt(clock.instant());
    return toResponse(insightEventRepository.save(event));
  }

  private boolean hasUnacknowledgedType(UUID orgId, UUID branchId, String insightType) {
    return insightEventRepository
        .findUnacknowledgedByOrgAndBranch(orgId, branchId, PageRequest.of(0, 20))
        .getContent()
        .stream()
        .anyMatch(event -> insightType.equals(event.getInsightType()));
  }

  private InsightEventResponse toResponse(InsightEvent event) {
    UUID branchId = event.getBranch() != null ? event.getBranch().getId() : null;
    return new InsightEventResponse(
        event.getId(),
        branchId,
        event.getInsightType(),
        event.getSeverity(),
        event.getTitle(),
        event.getBody(),
        event.getCreatedAt(),
        event.getAcknowledgedAt());
  }
}
