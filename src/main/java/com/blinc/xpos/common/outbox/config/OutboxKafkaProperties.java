package com.blinc.xpos.common.outbox.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "xpos.outbox.kafka")
public class OutboxKafkaProperties {

  /** Kafka topic to publish outbox events to. */
  private String topic = "xpos-outbox-events";

  /** Poll interval in milliseconds for the outbox consumer. */
  private long pollIntervalMs = 5000L;

  /** Maximum number of PENDING events to process per poll. */
  private int batchSize = 50;

  public String getTopic() {
    return topic;
  }

  public void setTopic(String topic) {
    this.topic = topic;
  }

  public long getPollIntervalMs() {
    return pollIntervalMs;
  }

  public void setPollIntervalMs(long pollIntervalMs) {
    this.pollIntervalMs = pollIntervalMs;
  }

  public int getBatchSize() {
    return batchSize;
  }

  public void setBatchSize(int batchSize) {
    this.batchSize = batchSize;
  }
}
