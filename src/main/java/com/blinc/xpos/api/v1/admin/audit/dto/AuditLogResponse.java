package com.blinc.xpos.api.v1.admin.audit.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.UUID;

public record AuditLogResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    UUID terminalId,
    UUID actorStaffUserId,
    String action,
    String entityType,
    UUID entityId,
    JsonNode beforeJson,
    JsonNode afterJson,
    Instant createdAt) {}
