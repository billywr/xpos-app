package com.blinc.xpos.modules.mpesa.dto;

import com.blinc.xpos.modules.mpesa.domain.MpesaConfigStatus;
import com.blinc.xpos.modules.mpesa.domain.MpesaEnvironment;

public record MpesaConfigUpdateRequest(
    MpesaEnvironment environment,
    String consumerKey,
    String consumerSecret,
    String passkey,
    String shortcode,
    String tillNumber,
    Boolean stkAutoComplete,
    String callbackBaseUrl,
    MpesaConfigStatus status) {}
