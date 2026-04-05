package com.blinc.xpos.common.outbox.consumer;

import com.blinc.xpos.common.constants.enums.OutboxStatus;
import com.blinc.xpos.common.outbox.config.OutboxKafkaProperties;
import com.blinc.xpos.common.outbox.domain.OutboxEvent;
import com.blinc.xpos.common.outbox.repository.OutboxEventRepository;
import com.blinc.xpos.common.outbox.service.OutboxEventService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.data.domain.PageRequest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Polls PENDING outbox events, publishes payloads to Kafka, and updates status to ACKED on success
 * or FAILED on failure. Only active when {@link KafkaTemplate} bean is available (Kafka
 * configured).
 */
@Component
@ConditionalOnBean(KafkaTemplate.class)
public class OutboxKafkaConsumer {

  private static final Logger log = LoggerFactory.getLogger(OutboxKafkaConsumer.class);

  private final OutboxEventRepository outboxEventRepository;
  private final OutboxEventService outboxEventService;
  private final OutboxKafkaProperties properties;
  private final ObjectMapper objectMapper;
  private final KafkaTemplate<String, String> kafkaTemplate;

  public OutboxKafkaConsumer(
      OutboxEventRepository outboxEventRepository,
      OutboxEventService outboxEventService,
      OutboxKafkaProperties properties,
      ObjectMapper objectMapper,
      KafkaTemplate<String, String> kafkaTemplate) {
    this.outboxEventRepository =
        Objects.requireNonNull(outboxEventRepository, "outboxEventRepository");
    this.outboxEventService = Objects.requireNonNull(outboxEventService, "outboxEventService");
    this.properties = Objects.requireNonNull(properties, "properties");
    this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
    this.kafkaTemplate = Objects.requireNonNull(kafkaTemplate, "kafkaTemplate");
  }

  @Scheduled(fixedDelayString = "${xpos.outbox.kafka.poll-interval-ms:5000}")
  public void processPending() {
    var page =
        outboxEventRepository.findByStatusOrderByCreatedAtAsc(
            OutboxStatus.PENDING, PageRequest.of(0, properties.getBatchSize()));

    for (OutboxEvent event : page.getContent()) {
      processOne(event);
    }
  }

  private void processOne(OutboxEvent event) {
    UUID orgId = event.getOrg().getId();
    UUID eventId = event.getId();
    String payloadJson;
    try {
      payloadJson = objectMapper.writeValueAsString(event.getPayload());
    } catch (JsonProcessingException e) {
      log.warn("Outbox event {} payload serialization failed", eventId, e);
      outboxEventService.updateStatus(orgId, eventId, OutboxStatus.FAILED, null);
      return;
    }

    String key = eventId.toString();
    String topic = properties.getTopic();

    kafkaTemplate
        .send(topic, key, payloadJson)
        .whenComplete(
            (result, ex) -> {
              if (ex != null) {
                log.warn("Outbox event {} send failed: {}", eventId, ex.getMessage());
                outboxEventService.updateStatus(orgId, eventId, OutboxStatus.FAILED, null);
                return;
              }
              Instant now = Instant.now();
              outboxEventService.updateStatus(orgId, eventId, OutboxStatus.ACKED, now);
              log.debug("Outbox event {} published to {} and marked ACKED", eventId, topic);
            });
  }
}
