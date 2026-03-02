package com.blinc.xpos.modules.reporting.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record ZReportSummaryResponse(
    UUID orgId,
    UUID branchId,
    LocalDate businessDate,
    BigDecimal salesTotal,
    BigDecimal taxTotal,
    BigDecimal cashTotal,
    BigDecimal mpesaTotal,
    BigDecimal cardTotal,
    BigDecimal otherTenderTotal,
    BigDecimal varianceTotal,
    int saleCount) {}
