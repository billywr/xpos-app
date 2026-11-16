package com.blinc.xpos.modules.assistant;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

class AssistantTimeRangeParserTest {

  private static final ZoneId ZONE = ZoneId.of("Africa/Nairobi");

  @Test
  void defaultsToTodayWhenNoPeriodMentioned() {
    LocalDate today = LocalDate.now(ZONE);
    AssistantTimeRange range = AssistantTimeRangeParser.resolve("top selling items", ZONE);
    assertThat(range.fromDate()).isEqualTo(today);
    assertThat(range.toDate()).isEqualTo(today);
    assertThat(range.label()).isEqualTo("today");
  }

  @Test
  void parsesThisWeekFromMondayThroughToday() {
    LocalDate today = LocalDate.now(ZONE);
    AssistantTimeRange range = AssistantTimeRangeParser.resolve("popular drink this week", ZONE);
    assertThat(range.label()).isEqualTo("this week");
    assertThat(range.fromDate().getDayOfWeek().name()).isEqualTo("MONDAY");
    assertThat(range.toDate()).isEqualTo(today);
  }

  @Test
  void parsesYesterday() {
    LocalDate today = LocalDate.now(ZONE);
    AssistantTimeRange range = AssistantTimeRangeParser.resolve("sales yesterday", ZONE);
    assertThat(range.fromDate()).isEqualTo(today.minusDays(1));
    assertThat(range.toDate()).isEqualTo(today.minusDays(1));
    assertThat(range.label()).isEqualTo("yesterday");
  }

  @Test
  void detectsExplicitPeriodInMessage() {
    assertThat(AssistantTimeRangeParser.hasExplicitPeriod("popular drinks this week")).isTrue();
    assertThat(AssistantTimeRangeParser.hasExplicitPeriod("sales today")).isFalse();
  }
}
