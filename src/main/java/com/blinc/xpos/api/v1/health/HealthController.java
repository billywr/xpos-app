package com.blinc.xpos.api.v1.health;

import java.time.Instant;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(value = "/api/v1/health", produces = MediaType.APPLICATION_JSON_VALUE)
public class HealthController {

  @GetMapping("/ping")
  public Map<String, Object> ping() {
    return Map.of("status", "UP", "timestamp", Instant.now().toString());
  }
}
