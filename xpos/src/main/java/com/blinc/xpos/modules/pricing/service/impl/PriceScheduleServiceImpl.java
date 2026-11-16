package com.blinc.xpos.modules.pricing.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.blinc.xpos.modules.pricing.domain.PriceSchedule;
import com.blinc.xpos.modules.pricing.repository.PriceScheduleRepository;
import com.blinc.xpos.modules.pricing.service.PriceScheduleService;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalTime;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PriceScheduleServiceImpl implements PriceScheduleService {

  private final PriceScheduleRepository priceScheduleRepository;
  private final OrgService orgService;
  private final BranchService branchService;
  private final Clock clock;

  public PriceScheduleServiceImpl(
      PriceScheduleRepository priceScheduleRepository,
      OrgService orgService,
      BranchService branchService,
      Clock clock) {
    this.priceScheduleRepository =
        Objects.requireNonNull(priceScheduleRepository, "priceScheduleRepository");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public PriceSchedule create(
      UUID orgId, UUID branchId, String name, String startsAt, String endsAt, int daysOfWeek) {
    Org org = orgService.require(orgId);
    Branch branch = branchService.require(orgId, branchId);
    PriceSchedule schedule = new PriceSchedule();
    schedule.setOrg(org);
    schedule.setBranch(branch);
    schedule.setName(name);
    schedule.setStartsAt(parseTime(startsAt));
    schedule.setEndsAt(parseTime(endsAt));
    schedule.setDaysOfWeek(daysOfWeek);
    Instant now = Instant.now(clock);
    schedule.setCreatedAt(now);
    schedule.setUpdatedAt(now);
    return priceScheduleRepository.save(schedule);
  }

  @Override
  @Transactional(readOnly = true)
  public PriceSchedule require(UUID orgId, UUID priceScheduleId) {
    return priceScheduleRepository
        .findByIdAndOrgId(priceScheduleId, orgId)
        .orElseThrow(
            () -> new NotFoundException("PRICE_SCHEDULE_NOT_FOUND", "Price schedule not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<PriceSchedule> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return priceScheduleRepository.findAllByOrgId(orgId, pageable);
  }

  @Override
  @Transactional
  public PriceSchedule update(
      UUID orgId,
      UUID priceScheduleId,
      UUID branchId,
      String name,
      String startsAt,
      String endsAt,
      int daysOfWeek) {
    PriceSchedule schedule = require(orgId, priceScheduleId);
    schedule.setBranch(branchService.require(orgId, branchId));
    schedule.setName(name);
    schedule.setStartsAt(parseTime(startsAt));
    schedule.setEndsAt(parseTime(endsAt));
    schedule.setDaysOfWeek(daysOfWeek);
    schedule.setUpdatedAt(Instant.now(clock));
    return priceScheduleRepository.save(schedule);
  }

  private static LocalTime parseTime(String time) {
    if (time == null || time.isBlank()) {
      throw new IllegalArgumentException("Time is required");
    }
    return LocalTime.parse(time.trim());
  }
}
