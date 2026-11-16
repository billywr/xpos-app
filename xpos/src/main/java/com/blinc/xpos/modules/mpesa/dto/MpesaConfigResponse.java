package com.blinc.xpos.modules.mpesa.dto;

import com.blinc.xpos.modules.mpesa.domain.MpesaConfigStatus;
import com.blinc.xpos.modules.mpesa.domain.MpesaEnvironment;
import java.time.Instant;
import java.util.UUID;

public record MpesaConfigResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    String branchName,
    MpesaEnvironment environment,
    String consumerKey,
    String consumerSecretMasked,
    String passkeyMasked,
    String shortcode,
    String tillNumber,
    boolean stkAutoComplete,
    String callbackBaseUrl,
    MpesaConfigStatus status,
    Instant createdAt,
    Instant updatedAt) {}
