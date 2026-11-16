package com.blinc.xpos.modules.mpesa.dto;

import com.blinc.xpos.modules.mpesa.domain.MpesaStkStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record MpesaStkStatusResponse(
    UUID id,
    UUID saleId,
    MpesaStkStatus status,
    BigDecimal amount,
    String phoneNumber,
    Integer resultCode,
    String resultDesc,
    String mpesaReceiptNumber,
    UUID tenderId,
    String saleStatus,
    boolean saleCompleted,
    Instant createdAt,
    Instant callbackAt) {}
