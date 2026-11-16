package com.blinc.xpos.modules.cash.service.impl;

import com.blinc.xpos.common.constants.enums.DayCloseStatus;
import com.blinc.xpos.common.constants.enums.ShiftStatus;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.auditvault.service.AuditLogService;
import com.blinc.xpos.modules.cash.domain.DayClose;
import com.blinc.xpos.modules.cash.repository.DayCloseRepository;
import com.blinc.xpos.modules.cash.repository.ShiftRepository;
import com.blinc.xpos.modules.cash.service.DayCloseService;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DayCloseServiceImpl implements DayCloseService {

  private final DayCloseRepository dayCloseRepository;
  private final ShiftRepository shiftRepository;
  private final BranchService branchService;
  private final StaffUserService staffUserService;
  private final AuditLogService auditLogService;
  private final Clock clock;

  public DayCloseServiceImpl(
      DayCloseRepository dayCloseRepository,
      ShiftRepository shiftRepository,
      BranchService branchService,
      StaffUserService staffUserService,
      AuditLogService auditLogService,
      Clock clock) {
    this.dayCloseRepository = Objects.requireNonNull(dayCloseRepository, "dayCloseRepository");
    this.shiftRepository = Objects.requireNonNull(shiftRepository, "shiftRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.staffUserService = Objects.requireNonNull(staffUserService, "staffUserService");
    this.auditLogService = Objects.requireNonNull(auditLogService, "auditLogService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public DayClose closeDay(
      UUID orgId, UUID branchId, LocalDate businessDate, UUID closedByStaffUserId) {
    Branch branch = branchService.require(orgId, branchId);
    if (shiftRepository.existsByBranchIdAndStatus(branchId, ShiftStatus.OPEN)) {
      throw new IllegalStateException(
          "Cannot close day: one or more shifts are still open. Close all shifts first.");
    }
    StaffUser closedBy = staffUserService.require(orgId, closedByStaffUserId);
    DayClose dayClose =
        dayCloseRepository
            .findByBranchIdAndBusinessDate(branchId, businessDate)
            .orElseGet(
                () -> {
                  DayClose newEntity = new DayClose();
                  newEntity.setOrg(branch.getOrg());
                  newEntity.setBranch(branch);
                  newEntity.setBusinessDate(businessDate);
                  newEntity.setStatus(DayCloseStatus.OPEN);
                  newEntity.setCreatedAt(Instant.now(clock));
                  return dayCloseRepository.save(newEntity);
                });
    dayClose.setStatus(DayCloseStatus.CLOSED);
    dayClose.setClosedBy(closedBy);
    dayClose.setClosedAt(Instant.now(clock));
    DayClose saved = dayCloseRepository.save(dayClose);
    auditLogService.append(
        orgId,
        branchId,
        null,
        closedByStaffUserId,
        "DAY_CLOSE",
        "DayClose",
        saved.getId(),
        null,
        null);
    return saved;
  }

  @Override
  @Transactional(readOnly = true)
  public DayClose require(UUID orgId, UUID dayCloseId) {
    return dayCloseRepository
        .findByIdAndOrgId(dayCloseId, orgId)
        .orElseThrow(() -> new NotFoundException("DAY_CLOSE_NOT_FOUND", "Day close not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<DayClose> findByBranchAndDate(UUID orgId, UUID branchId, LocalDate businessDate) {
    branchService.require(orgId, branchId);
    return dayCloseRepository.findByBranchIdAndBusinessDate(branchId, businessDate);
  }

  @Override
  @Transactional(readOnly = true)
  public Page<DayClose> listByBranch(UUID orgId, UUID branchId, Pageable pageable) {
    branchService.require(orgId, branchId);
    return dayCloseRepository.findAllByBranchId(branchId, pageable);
  }
}
