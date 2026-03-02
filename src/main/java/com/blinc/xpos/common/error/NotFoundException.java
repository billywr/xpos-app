package com.blinc.xpos.common.error;

import org.springframework.http.HttpStatus;

public class NotFoundException extends ApiException {

  public NotFoundException(String code, String message) {
    super(HttpStatus.NOT_FOUND, code, message);
  }

  public static NotFoundException of(String entity, String id) {
    return new NotFoundException("NOT_FOUND", entity + " not found: " + id);
  }
}
