package com.blinc.xpos.modules.debt.dto;

import java.math.BigDecimal;
import java.util.List;

public record CustomerDebtBulkSettleResult(
    BigDecimal paymentAmount,
    BigDecimal totalApplied,
    BigDecimal unallocated,
    List<CustomerDebtBulkSettleAllocation> allocations) {}
