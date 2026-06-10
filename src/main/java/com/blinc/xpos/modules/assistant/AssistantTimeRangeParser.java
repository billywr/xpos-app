package com.blinc.xpos.modules.assistant;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.Locale;

/** Zero-token date-range parser for assistant questions (today, this week, yesterday, etc.). */
public final class AssistantTimeRangeParser {

  private AssistantTimeRangeParser() {}

  public static AssistantTimeRange resolve(String rawMessage, ZoneId zone) {
    LocalDate today = LocalDate.now(zone);
    if (rawMessage == null || rawMessage.isBlank()) {
      return todayOnly(today);
    }
    String message = rawMessage.toLowerCase(Locale.ROOT);

    if (containsAny(message, "yesterday")) {
      LocalDate day = today.minusDays(1);
      return new AssistantTimeRange(day, day, "yesterday");
    }
    if (containsAny(message, "last week", "previous week", "past week")) {
      LocalDate thisWeekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
      LocalDate lastWeekEnd = thisWeekStart.minusDays(1);
      LocalDate lastWeekStart =
          lastWeekEnd.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
      return new AssistantTimeRange(lastWeekStart, lastWeekEnd, "last week");
    }
    if (containsAny(message, "this week", "this week's", "this weeks")) {
      LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
      return new AssistantTimeRange(weekStart, today, "this week");
    }
    if (containsAny(message, "last month", "previous month")) {
      LocalDate firstOfThisMonth = today.withDayOfMonth(1);
      LocalDate lastMonthEnd = firstOfThisMonth.minusDays(1);
      LocalDate lastMonthStart = lastMonthEnd.withDayOfMonth(1);
      return new AssistantTimeRange(lastMonthStart, lastMonthEnd, "last month");
    }
    if (containsAny(message, "this month", "this month's", "this months")) {
      LocalDate monthStart = today.withDayOfMonth(1);
      return new AssistantTimeRange(monthStart, today, "this month");
    }
    if (containsAny(message, "last 7 days", "last seven days", "past 7 days", "past seven days")) {
      return new AssistantTimeRange(today.minusDays(6), today, "the last 7 days");
    }
    if (containsAny(message, "last 30 days", "last thirty days", "past 30 days")) {
      return new AssistantTimeRange(today.minusDays(29), today, "the last 30 days");
    }
    return todayOnly(today);
  }

  public static boolean hasExplicitPeriod(String rawMessage) {
    if (rawMessage == null || rawMessage.isBlank()) {
      return false;
    }
    String message = rawMessage.toLowerCase(Locale.ROOT);
    return containsAny(
        message,
        "yesterday",
        "last week",
        "previous week",
        "past week",
        "this week",
        "this week's",
        "this weeks",
        "last month",
        "previous month",
        "this month",
        "this month's",
        "this months",
        "last 7 days",
        "last seven days",
        "past 7 days",
        "last 30 days",
        "last thirty days",
        "past 30 days");
  }

  private static AssistantTimeRange todayOnly(LocalDate today) {
    return new AssistantTimeRange(today, today, "today");
  }

  private static boolean containsAny(String message, String... needles) {
    for (String needle : needles) {
      if (message.contains(needle)) {
        return true;
      }
    }
    return false;
  }
}
