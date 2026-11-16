package com.blinc.xpos.api.v1.admin.audit.dto;

import java.time.Instant;
import java.util.UUID;

public record AuditVaultRecordResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    UUID terminalId,
    String eventType,
    UUID eventId,
    String payloadHash,
    String previousHash,
    String hash,
    Instant createdAt) {}
