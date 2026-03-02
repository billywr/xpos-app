package com.blinc.xpos.common.error;

import org.springframework.http.HttpStatus;

public class ConflictException extends ApiException {

  public ConflictException(String code, String message) {
    super(HttpStatus.CONFLICT, code, message);
  }

  public static ConflictException of(String message) {
    return new ConflictException("CONFLICT", message);
  }
}
