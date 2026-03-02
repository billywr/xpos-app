package com.blinc.xpos.common.outbox.service;

import com.blinc.xpos.common.constants.enums.OutboxStatus;
import com.blinc.xpos.common.outbox.domain.OutboxEvent;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface OutboxEventService {

  OutboxEvent enqueue(
      UUID orgId, UUID terminalId, String eventType, JsonNode payload, String idempotencyKey);

  OutboxEvent require(UUID orgId, UUID eventId);

  Page<OutboxEvent> list(UUID orgId, Pageable pageable);

  /**
   * Updates the status (and optionally syncedAt) of an outbox event. Used by the outbox consumer
   * when events are sent to Kafka (SENT/ACKED) or fail (FAILED).
   */
  void updateStatus(UUID orgId, UUID eventId, OutboxStatus status, Instant syncedAt);
}
