package com.blinc.xpos.modules.inventory.scheduler;

import com.blinc.xpos.modules.inventory.domain.StockTakingSchedule;
import com.blinc.xpos.modules.inventory.repository.StockTakingScheduleRepository;
import com.blinc.xpos.modules.inventory.service.StockCountSessionService;
import com.blinc.xpos.modules.organization.repository.StaffBranchAssignmentRepository;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Creates stock count sessions automatically when schedules are due. Runs every minute. Uses server
 * default timezone for schedule matching.
 */
@Component
public class StockTakingScheduler {

  private static final Logger log = LoggerFactory.getLogger(StockTakingScheduler.class);

  private final StockTakingScheduleRepository scheduleRepository;
  private final StaffBranchAssignmentRepository assignmentRepository;
  private final StockCountSessionService sessionService;

  @Value("${xpos.stock-taking.timezone:Africa/Nairobi}")
  private String scheduleTimezone;

  public StockTakingScheduler(
      StockTakingScheduleRepository scheduleRepository,
      StaffBranchAssignmentRepository assignmentRepository,
      StockCountSessionService sessionService) {
    this.scheduleRepository = scheduleRepository;
    this.assignmentRepository = assignmentRepository;
    this.sessionService = sessionService;
  }

  @Scheduled(cron = "${xpos.stock-taking.cron:0 * * * * ?}")
  public void createDueSessions() {
    List<StockTakingSchedule> active = scheduleRepository.findAllActive();
    ZoneId zone = ZoneId.of(scheduleTimezone);
    ZonedDateTime now = ZonedDateTime.now(zone);

    for (StockTakingSchedule schedule : active) {
      if (!isDue(schedule, now)) {
        continue;
      }
      if (alreadyRanThisPeriod(schedule, now, zone)) {
        continue;
      }
      try {
        createSessionForSchedule(schedule);
      } catch (Exception e) {
        log.warn(
            "Failed to create scheduled stock count for branch {}: {}",
            schedule.getBranch().getId(),
            e.getMessage(),
            e);
      }
    }
  }

  private boolean isDue(StockTakingSchedule s, ZonedDateTime now) {
    if (s.getScheduledHour() != now.getHour()
        || s.getScheduledMinute() != now.getMinute()) {
      return false;
    }
    if (StockTakingSchedule.FREQUENCY_DAILY.equals(s.getFrequency())) {
      return true;
    }
    if (StockTakingSchedule.FREQUENCY_WEEKLY.equals(s.getFrequency())
        && s.getDayOfWeek() != null) {
      int javaDay = s.getDayOfWeek() == 0 ? 7 : s.getDayOfWeek();
      return now.getDayOfWeek().getValue() == javaDay;
    }
    return false;
  }

  private boolean alreadyRanThisPeriod(
      StockTakingSchedule s, ZonedDateTime now, ZoneId zone) {
    Instant lastRun = s.getLastRunAt();
    if (lastRun == null) {
      return false;
    }
    ZonedDateTime lastRunZoned = lastRun.atZone(zone);
    if (StockTakingSchedule.FREQUENCY_DAILY.equals(s.getFrequency())) {
      return lastRunZoned.toLocalDate().equals(now.toLocalDate());
    }
    if (StockTakingSchedule.FREQUENCY_WEEKLY.equals(s.getFrequency())
        && s.getDayOfWeek() != null) {
      int lastRunWeek = lastRunZoned.get(java.time.temporal.WeekFields.ISO.weekOfWeekBasedYear());
      int lastRunYear = lastRunZoned.get(java.time.temporal.WeekFields.ISO.weekBasedYear());
      int nowWeek = now.get(java.time.temporal.WeekFields.ISO.weekOfWeekBasedYear());
      int nowYear = now.get(java.time.temporal.WeekFields.ISO.weekBasedYear());
      return lastRunWeek == nowWeek && lastRunYear == nowYear;
    }
    return false;
  }

  private void createSessionForSchedule(StockTakingSchedule schedule) {
    UUID orgId = schedule.getOrg().getId();
    UUID branchId = schedule.getBranch().getId();

    var assignments =
        assignmentRepository.findAllByOrgIdAndBranchId(
            orgId, branchId, org.springframework.data.domain.PageRequest.of(0, 1));
    if (assignments.isEmpty()) {
      log.warn(
          "Skipping scheduled stock take for branch {}: no staff assigned",
          branchId);
      return;
    }
    UUID staffUserId = assignments.getContent().get(0).getStaffUser().getId();
    sessionService.startScheduled(orgId, branchId, schedule.getId(), staffUserId);
    scheduleRepository.updateLastRunAt(schedule.getId(), Instant.now());
    log.info(
        "Created scheduled stock count session for branch {} (schedule {})",
        branchId,
        schedule.getId());
  }
}
