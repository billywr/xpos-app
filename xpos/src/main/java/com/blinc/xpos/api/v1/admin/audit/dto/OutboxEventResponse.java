package com.blinc.xpos.api.v1.admin.audit.dto;

import com.blinc.xpos.common.constants.enums.OutboxStatus;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.UUID;

public record OutboxEventResponse(
    UUID id,
    UUID orgId,
    UUID terminalId,
    String eventType,
    JsonNode payload,
    String idempotencyKey,
    Instant createdAt,
    Instant syncedAt,
    OutboxStatus status) {}
