package com.blinc.xpos.modules.assistant.dto;

import java.time.Instant;
import java.util.UUID;

public record InsightEventResponse(
    UUID id,
    UUID branchId,
    String insightType,
    String severity,
    String title,
    String body,
    Instant createdAt,
    Instant acknowledgedAt) {}
