package com.blinc.xpos.modules.assistant.dto;

import java.util.Map;

/** Optional UI context passed with an assistant query. */
public record AssistantScreenContext(String screen, Map<String, String> filters) {}
