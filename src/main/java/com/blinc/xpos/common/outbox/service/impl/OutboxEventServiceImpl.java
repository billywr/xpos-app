package com.blinc.xpos.common.outbox.service.impl;

import com.blinc.xpos.common.constants.enums.OutboxStatus;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.common.outbox.domain.OutboxEvent;
import com.blinc.xpos.common.outbox.repository.OutboxEventRepository;
import com.blinc.xpos.common.outbox.service.OutboxEventService;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.blinc.xpos.modules.organization.service.TerminalService;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OutboxEventServiceImpl implements OutboxEventService {

  private final OutboxEventRepository outboxEventRepository;
  private final OrgService orgService;
  private final TerminalService terminalService;
  private final Clock clock;

  public OutboxEventServiceImpl(
      OutboxEventRepository outboxEventRepository,
      OrgService orgService,
      TerminalService terminalService,
      Clock clock) {
    this.outboxEventRepository = Objects.requireNonNull(outboxEventRepository);
    this.orgService = Objects.requireNonNull(orgService);
    this.terminalService = Objects.requireNonNull(terminalService);
    this.clock = Objects.requireNonNull(clock);
  }

  @Override
  @Transactional
  public OutboxEvent enqueue(
      UUID orgId,
      UUID terminalId,
      String eventType,
      JsonNode payload,
      String idempotencyKey) {
    var terminal = terminalService.require(orgId, terminalId);
    if (payload == null) {
      throw new IllegalArgumentException("payload is required");
    }
    if (idempotencyKey == null || idempotencyKey.isBlank()) {
      throw new IllegalArgumentException("idempotencyKey is required");
    }
    Instant now = Instant.now(clock);
    OutboxEvent event = new OutboxEvent();
    event.setOrg(terminal.getOrg());
    event.setTerminal(terminal);
    event.setEventType(eventType != null ? eventType : "");
    event.setPayload(payload);
    event.setIdempotencyKey(idempotencyKey.trim());
    event.setCreatedAt(now);
    event.setStatus(OutboxStatus.PENDING);
    return outboxEventRepository.save(event);
  }

  @Override
  @Transactional(readOnly = true)
  public OutboxEvent require(UUID orgId, UUID eventId) {
    return outboxEventRepository
        .findByIdAndOrgId(eventId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "OUTBOX_EVENT_NOT_FOUND", "Outbox event not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<OutboxEvent> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return outboxEventRepository.findAllByOrgId(orgId, pageable);
  }

  @Override
  @Transactional
  public void updateStatus(UUID orgId, UUID eventId, OutboxStatus status, Instant syncedAt) {
    OutboxEvent event = require(orgId, eventId);
    event.setStatus(Objects.requireNonNull(status, "status"));
    if (syncedAt != null) {
      event.setSyncedAt(syncedAt);
    }
    outboxEventRepository.save(event);
  }
}
