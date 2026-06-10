package com.blinc.xpos.modules.assistant;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/** Simple in-memory per-staff hourly rate limit for assistant queries. */
@Component
public class AssistantRateLimiter {

  private final ConcurrentHashMap<UUID, Window> windows = new ConcurrentHashMap<>();

  public boolean tryAcquire(UUID staffUserId, int limitPerHour) {
    long now = System.currentTimeMillis();
    Window window =
        windows.compute(
            staffUserId,
            (id, existing) -> {
              if (existing == null || now - existing.startMs > 3_600_000L) {
                return new Window(now, 1);
              }
              existing.count++;
              return existing;
            });
    return window.count <= limitPerHour;
  }

  private static final class Window {
    private final long startMs;
    private int count;

    private Window(long startMs, int count) {
      this.startMs = startMs;
      this.count = count;
    }
  }
}
