package com.blinc.xpos.common.outbox.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(OutboxKafkaProperties.class)
public class OutboxKafkaConfig {}
