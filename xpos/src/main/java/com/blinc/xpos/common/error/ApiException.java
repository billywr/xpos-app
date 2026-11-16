package com.blinc.xpos.common.error;

import java.util.Objects;
import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {

  private final HttpStatus status;
  private final String code;

  public ApiException(HttpStatus status, String code, String message) {
    super(message);
    this.status = Objects.requireNonNull(status, "status");
    this.code = Objects.requireNonNull(code, "code");
  }

  public HttpStatus getStatus() {
    return status;
  }

  public String getCode() {
    return code;
  }
}
