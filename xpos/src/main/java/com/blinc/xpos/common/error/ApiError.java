package com.blinc.xpos.common.error;

import java.time.Instant;
import java.util.List;

public record ApiError(
    Instant timestamp,
    int status,
    String error,
    String code,
    String message,
    String path,
    String requestId,
    List<ApiErrorDetail> details) {}
