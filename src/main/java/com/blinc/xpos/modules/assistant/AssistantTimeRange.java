package com.blinc.xpos.modules.assistant;

import java.time.LocalDate;
import java.time.ZoneId;

/** Parsed reporting window extracted from natural-language assistant questions. */
public record AssistantTimeRange(LocalDate fromDate, LocalDate toDate, String label) {

  public java.time.Instant rangeStart(ZoneId zone) {
    return fromDate.atStartOfDay(zone).toInstant();
  }

  public java.time.Instant rangeEndExclusive(ZoneId zone) {
    return toDate.plusDays(1).atStartOfDay(zone).toInstant();
  }

  public boolean isSingleDay() {
    return fromDate.equals(toDate);
  }
}
