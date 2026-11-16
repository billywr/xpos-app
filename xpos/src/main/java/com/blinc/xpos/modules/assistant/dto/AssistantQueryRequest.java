package com.blinc.xpos.modules.assistant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;

public record AssistantQueryRequest(
    @NotBlank(message = "Message is required")
        @Size(max = 500, message = "Message must be at most 500 characters")
        String message,
    String screen,
    Map<String, String> filters) {

  public AssistantQueryRequest(String message) {
    this(message, null, null);
  }
}
