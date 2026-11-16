package com.blinc.xpos.modules.assistant.dto;

import java.util.Map;
import java.util.UUID;

/** Caller and scope metadata for an assistant query (org/branch/staff accountability). */
public record AssistantQueryContext(
    UUID orgId,
    UUID branchId,
    UUID staffUserId,
    String staffDisplayName,
    String iamUserId,
    String branchName,
    String message,
    String requestId,
    String screen,
    Map<String, String> filters,
    boolean adminAccess) {}
