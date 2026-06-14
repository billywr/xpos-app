package com.blinc.xpos.api.v1.operator.dto;

import java.math.BigDecimal;
import java.util.List;

public record DebtBulkSettleResponse(
    BigDecimal paymentAmount,
    BigDecimal totalApplied,
    BigDecimal unallocated,
    List<DebtBulkSettleAllocationLineDto> allocations) {}
