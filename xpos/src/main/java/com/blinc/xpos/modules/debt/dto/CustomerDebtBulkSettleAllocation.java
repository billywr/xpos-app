package com.blinc.xpos.modules.debt.dto;

import com.blinc.xpos.common.constants.enums.CustomerDebtStatus;
import java.math.BigDecimal;
import java.util.UUID;

public record CustomerDebtBulkSettleAllocation(
    UUID debtId,
    BigDecimal appliedAmount,
    BigDecimal outstandingBefore,
    BigDecimal outstandingAfter,
    CustomerDebtStatus status) {}
