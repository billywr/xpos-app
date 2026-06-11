package com.blinc.xpos.modules.mpesa.dto;

import com.blinc.xpos.modules.mpesa.domain.MpesaEnvironment;

public record MpesaConfigVerifyResponse(boolean ok, MpesaEnvironment environment, String message) {}
