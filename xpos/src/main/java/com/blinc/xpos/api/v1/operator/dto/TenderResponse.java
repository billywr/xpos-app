package com.blinc.xpos.api.v1.operator.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TenderResponse(
    UUID id,
    UUID saleId,
    UUID tenderTypeId,
    String tenderTypeCode,
    BigDecimal amount,
    String currency,
    UUID capturedByStaffUserId,
    Instant capturedAt) {}
