package com.blinc.xpos.modules.assistant.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record AssistantQueryResponse(
    String answer,
    String intent,
    List<String> suggestions,
    Map<String, Object> data,
    List<AssistantCitation> citations,
    String requestId,
    Instant dataAsOf,
    boolean llmUsed,
    long latencyMs) {

  /** Backward-compatible constructor for tests and simple callers. */
  public AssistantQueryResponse(
      String answer, String intent, List<String> suggestions, Map<String, Object> data) {
    this(answer, intent, suggestions, data, List.of(), null, Instant.now(), false, 0L);
  }
}
