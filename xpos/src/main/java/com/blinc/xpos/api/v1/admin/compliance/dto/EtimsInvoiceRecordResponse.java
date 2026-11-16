package com.blinc.xpos.api.v1.admin.compliance.dto;

import com.blinc.xpos.common.constants.enums.EtimsStatus;
import java.time.Instant;
import java.util.UUID;

public record EtimsInvoiceRecordResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    UUID saleId,
    EtimsStatus submissionStatus,
    String fiscalCode,
    String qrPayload,
    Instant submittedAt,
    String lastError,
    Instant createdAt,
    Instant updatedAt) {}
