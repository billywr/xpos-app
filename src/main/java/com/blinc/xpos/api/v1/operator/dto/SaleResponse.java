package com.blinc.xpos.api.v1.operator.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SaleResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    UUID terminalId,
    UUID shiftId,
    String status,
    UUID receiptId,
    UUID customerId,
    BigDecimal subtotal,
    BigDecimal taxTotal,
    BigDecimal discountTotal,
    BigDecimal serviceChargeTotal,
    BigDecimal total,
    UUID createdByStaffUserId,
    Instant createdAt,
    Instant completedAt,
    List<SaleLineResponse> lines,
    List<TenderResponse> tenders) {}
