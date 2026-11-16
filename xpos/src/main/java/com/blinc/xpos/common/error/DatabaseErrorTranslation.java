package com.blinc.xpos.common.error;

import java.util.List;
import org.springframework.http.HttpStatus;

public record DatabaseErrorTranslation(
    HttpStatus status, String code, String message, List<ApiErrorDetail> details) {}
