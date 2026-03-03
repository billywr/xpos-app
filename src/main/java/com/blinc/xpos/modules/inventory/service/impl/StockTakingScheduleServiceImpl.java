package com.blinc.xpos.modules.inventory.service.impl;

import com.blinc.xpos.common.error.ConflictException;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.inventory.domain.StockCountSession;
import com.blinc.xpos.modules.inventory.domain.StockTakingSchedule;
import com.blinc.xpos.modules.inventory.repository.StockTakingScheduleRepository;
import com.blinc.xpos.modules.inventory.service.StockCountSessionService;
import com.blinc.xpos.modules.inventory.service.StockTakingScheduleService;
import com.blinc.xpos.modules.organization.service.BranchService;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StockTakingScheduleServiceImpl implements StockTakingScheduleService {

  private final StockTakingScheduleRepository scheduleRepository;
  private final BranchService branchService;
  private final StockCountSessionService sessionService;
  private final Clock clock;

  public StockTakingScheduleServiceImpl(
      StockTakingScheduleRepository scheduleRepository,
      BranchService branchService,
      StockCountSessionService sessionService,
      Clock clock) {
    this.scheduleRepository = Objects.requireNonNull(scheduleRepository, "scheduleRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.sessionService = Objects.requireNonNull(sessionService, "sessionService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public StockTakingSchedule create(
      UUID orgId,
      UUID branchId,
      String frequency,
      Integer dayOfWeek,
      int scheduledHour,
      int scheduledMinute) {
    branchService.require(orgId, branchId);
    if (scheduleRepository.findByOrgIdAndBranchId(orgId, branchId).isPresent()) {
      throw new ConflictException(
          "STOCK_TAKING_SCHEDULE_EXISTS",
          "A stock taking schedule already exists for this branch. Update or delete it first.");
    }
    validateScheduleParams(frequency, dayOfWeek, scheduledHour, scheduledMinute);

    var branch = branchService.require(orgId, branchId);
    Instant now = Instant.now(clock);
    StockTakingSchedule schedule = new StockTakingSchedule();
    schedule.setOrg(branch.getOrg());
    schedule.setBranch(branch);
    schedule.setFrequency(frequency);
    schedule.setDayOfWeek(dayOfWeek);
    schedule.setScheduledHour(scheduledHour);
    schedule.setScheduledMinute(scheduledMinute);
    schedule.setIsActive(true);
    schedule.setCreatedAt(now);
    schedule.setUpdatedAt(now);
    return scheduleRepository.save(schedule);
  }

  @Override
  @Transactional(readOnly = true)
  public StockTakingSchedule require(UUID orgId, UUID scheduleId) {
    return scheduleRepository
        .findByIdAndOrgId(scheduleId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "STOCK_TAKING_SCHEDULE_NOT_FOUND",
                    "Stock taking schedule not found: " + scheduleId));
  }

  @Override
  @Transactional
  public StockTakingSchedule update(
      UUID orgId,
      UUID scheduleId,
      String frequency,
      Integer dayOfWeek,
      int scheduledHour,
      int scheduledMinute,
      boolean isActive) {
    StockTakingSchedule schedule = require(orgId, scheduleId);
    validateScheduleParams(frequency, dayOfWeek, scheduledHour, scheduledMinute);

    schedule.setFrequency(frequency);
    schedule.setDayOfWeek(dayOfWeek);
    schedule.setScheduledHour(scheduledHour);
    schedule.setScheduledMinute(scheduledMinute);
    schedule.setIsActive(isActive);
    schedule.setUpdatedAt(Instant.now(clock));
    return scheduleRepository.save(schedule);
  }

  @Override
  @Transactional(readOnly = true)
  public Page<StockTakingSchedule> listByOrg(UUID orgId, Pageable pageable) {
    return scheduleRepository.findAllByOrgId(orgId, pageable);
  }

  @Override
  @Transactional(readOnly = true)
  public StockTakingSchedule getByBranch(UUID orgId, UUID branchId) {
    branchService.require(orgId, branchId);
    return scheduleRepository
        .findByOrgIdAndBranchId(orgId, branchId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "STOCK_TAKING_SCHEDULE_NOT_FOUND",
                    "No stock taking schedule configured for this branch."));
  }

  @Override
  @Transactional
  public void delete(UUID orgId, UUID scheduleId) {
    StockTakingSchedule schedule = require(orgId, scheduleId);
    scheduleRepository.delete(schedule);
  }

  @Override
  @Transactional
  public StockCountSession trigger(UUID orgId, UUID scheduleId, UUID triggeredByStaffUserId) {
    StockTakingSchedule schedule = require(orgId, scheduleId);
    if (!Boolean.TRUE.equals(schedule.getIsActive())) {
      throw new IllegalArgumentException("Schedule is inactive. Activate it before triggering.");
    }
    UUID branchId = schedule.getBranch().getId();
    StockCountSession session =
        sessionService.startScheduled(orgId, branchId, scheduleId, triggeredByStaffUserId);
    scheduleRepository.updateLastRunAt(scheduleId, Instant.now(clock));
    return session;
  }

  private void validateScheduleParams(
      String frequency, Integer dayOfWeek, int scheduledHour, int scheduledMinute) {
    if (frequency == null
        || (!StockTakingSchedule.FREQUENCY_DAILY.equals(frequency)
            && !StockTakingSchedule.FREQUENCY_WEEKLY.equals(frequency))) {
      throw new IllegalArgumentException("Frequency must be DAILY or WEEKLY");
    }
    if (StockTakingSchedule.FREQUENCY_WEEKLY.equals(frequency)
        && (dayOfWeek == null || dayOfWeek < 0 || dayOfWeek > 6)) {
      throw new IllegalArgumentException(
          "Day of week (0=Sunday..6=Saturday) is required when frequency is WEEKLY");
    }
    if (StockTakingSchedule.FREQUENCY_DAILY.equals(frequency) && dayOfWeek != null) {
      throw new IllegalArgumentException("Day of week must be null when frequency is DAILY");
    }
    if (scheduledHour < 0 || scheduledHour > 23 || scheduledMinute < 0 || scheduledMinute > 59) {
      throw new IllegalArgumentException("Invalid scheduled time: hour 0-23, minute 0-59");
    }
  }
}
