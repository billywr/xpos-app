package com.blinc.xpos.modules.mpesa.dto;

import com.blinc.xpos.modules.mpesa.domain.MpesaEnvironment;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record MpesaConfigCreateRequest(
    @NotNull(message = "environment is required") MpesaEnvironment environment,
    @NotBlank(message = "consumerKey is required") String consumerKey,
    @NotBlank(message = "consumerSecret is required") String consumerSecret,
    String passkey,
    @NotBlank(message = "shortcode is required") String shortcode,
    String tillNumber,
    boolean stkAutoComplete,
    String callbackBaseUrl,
    String branchId) {}
