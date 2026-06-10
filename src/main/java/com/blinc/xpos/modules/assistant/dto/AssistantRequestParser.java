package com.blinc.xpos.modules.assistant.dto;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;

/** Parses assistant query bodies, including legacy double-encoded JSON strings. */
public final class AssistantRequestParser {

  private AssistantRequestParser() {}

  public static String extractMessage(ObjectMapper objectMapper, JsonNode rawBody) {
    return parseRequest(objectMapper, rawBody).message();
  }

  public static AssistantQueryRequest parseRequest(ObjectMapper objectMapper, JsonNode rawBody) {
    if (rawBody == null || rawBody.isNull()) {
      return new AssistantQueryRequest(null);
    }
    JsonNode node = rawBody;
    if (node.isTextual()) {
      try {
        node = objectMapper.readTree(node.asText());
      } catch (JsonProcessingException ex) {
        return new AssistantQueryRequest(null);
      }
    }
    if (!node.isObject()) {
      return new AssistantQueryRequest(null);
    }
    String message =
        node.hasNonNull("message") && node.get("message").isTextual()
            ? node.get("message").asText()
            : null;
    String screen =
        node.hasNonNull("screen") && node.get("screen").isTextual()
            ? node.get("screen").asText()
            : null;
    Map<String, String> filters = null;
    JsonNode filtersNode = node.get("filters");
    if (filtersNode != null && filtersNode.isObject()) {
      filters =
          objectMapper.convertValue(
              filtersNode,
              objectMapper
                  .getTypeFactory()
                  .constructMapType(LinkedHashMap.class, String.class, String.class));
    }
    return new AssistantQueryRequest(message, screen, filters);
  }
}
