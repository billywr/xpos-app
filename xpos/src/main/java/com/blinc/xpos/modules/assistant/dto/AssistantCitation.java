package com.blinc.xpos.modules.assistant.dto;

import java.time.Instant;

/** Traceability metadata for an assistant answer. */
public record AssistantCitation(String tool, String requestId, Instant asOf) {}
