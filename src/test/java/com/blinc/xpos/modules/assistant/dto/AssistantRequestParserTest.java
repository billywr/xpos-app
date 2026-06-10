package com.blinc.xpos.modules.assistant.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class AssistantRequestParserTest {

  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  void extractsMessageFromObjectBody() throws Exception {
    var node = objectMapper.readTree("{\"message\":\"Sales today\"}");
    assertThat(AssistantRequestParser.extractMessage(objectMapper, node)).isEqualTo("Sales today");
  }

  @Test
  void extractsMessageFromDoubleEncodedStringBody() throws Exception {
    var node = objectMapper.readTree("\"{\\\"message\\\":\\\"who has the most debt\\\"}\"");
    assertThat(AssistantRequestParser.extractMessage(objectMapper, node))
        .isEqualTo("who has the most debt");
  }

  @Test
  void returnsNullForMissingMessage() throws Exception {
    assertThat(AssistantRequestParser.extractMessage(objectMapper, objectMapper.readTree("{}")))
        .isNull();
  }
}
