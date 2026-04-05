package com.blinc.xpos.modules.cash.service.impl;

import com.blinc.xpos.common.constants.enums.ShiftStatus;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.cash.domain.Shift;
import com.blinc.xpos.modules.cash.repository.ShiftRepository;
import com.blinc.xpos.modules.cash.service.ShiftExpectedCashService;
import com.blinc.xpos.modules.cash.service.ShiftService;
import com.blinc.xpos.modules.fraud.domain.ReasonCode;
import com.blinc.xpos.modules.fraud.repository.ReasonCodeRepository;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.domain.Terminal;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import com.blinc.xpos.modules.organization.service.TerminalService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ShiftServiceImpl implements ShiftService {

  private final ShiftRepository shiftRepository;
  private final BranchService branchService;
  private final TerminalService terminalService;
  private final StaffUserService staffUserService;
  private final ReasonCodeRepository reasonCodeRepository;
  private final ShiftExpectedCashService shiftExpectedCashService;
  private final Clock clock;

  public ShiftServiceImpl(
      ShiftRepository shiftRepository,
      BranchService branchService,
      TerminalService terminalService,
      StaffUserService staffUserService,
      ReasonCodeRepository reasonCodeRepository,
      ShiftExpectedCashService shiftExpectedCashService,
      Clock clock) {
    this.shiftRepository = Objects.requireNonNull(shiftRepository, "shiftRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.terminalService = Objects.requireNonNull(terminalService, "terminalService");
    this.staffUserService = Objects.requireNonNull(staffUserService, "staffUserService");
    this.reasonCodeRepository =
        Objects.requireNonNull(reasonCodeRepository, "reasonCodeRepository");
    this.shiftExpectedCashService =
        Objects.requireNonNull(shiftExpectedCashService, "shiftExpectedCashService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public Shift openShift(
      UUID orgId, UUID branchId, UUID terminalId, UUID staffUserId, BigDecimal openingFloatAmount) {
    branchService.require(orgId, branchId);
    Terminal terminal = terminalService.require(orgId, terminalId);
    if (!terminal.getBranch().getId().equals(branchId)) {
      throw new NotFoundException("TERMINAL_NOT_FOUND", "Terminal not found in this branch");
    }
    Optional<Shift> existing =
        shiftRepository.findByTerminalIdAndStatus(terminalId, ShiftStatus.OPEN);
    if (existing.isPresent()) {
      throw new IllegalStateException(
          "A shift is already open for this terminal. Close it before opening a new one.");
    }
    StaffUser staffUser = staffUserService.require(orgId, staffUserId);
    Shift shift = new Shift();
    shift.setOrg(terminal.getOrg());
    shift.setBranch(terminal.getBranch());
    shift.setTerminal(terminal);
    shift.setStaffUser(staffUser);
    Instant now = Instant.now(clock);
    shift.setOpenedAt(now);
    shift.setStatus(ShiftStatus.OPEN);
    shift.setOpeningFloatAmount(
        openingFloatAmount != null && openingFloatAmount.compareTo(BigDecimal.ZERO) >= 0
            ? openingFloatAmount
            : BigDecimal.ZERO);
    return shiftRepository.save(shift);
  }

  @Override
  @Transactional
  public Shift closeShift(
      UUID orgId,
      UUID shiftId,
      BigDecimal closingCountedAmount,
      BigDecimal expectedCashAmount,
      BigDecimal varianceAmount,
      UUID varianceReasonCodeId,
      UUID closedByManagerId) {
    Shift shift = require(orgId, shiftId);
    if (shift.getStatus() == ShiftStatus.CLOSED) {
      throw new IllegalStateException("Shift is already closed.");
    }
    shift.setClosedAt(Instant.now(clock));
    shift.setStatus(ShiftStatus.CLOSED);
    shift.setClosingCountedAmount(closingCountedAmount);
    shift.setExpectedCashAmount(expectedCashAmount);
    shift.setVarianceAmount(varianceAmount);
    if (varianceReasonCodeId != null) {
      ReasonCode reason =
          reasonCodeRepository
              .findByIdAndOrgId(varianceReasonCodeId, orgId)
              .orElseThrow(
                  () -> new NotFoundException("REASON_CODE_NOT_FOUND", "Reason code not found"));
      shift.setVarianceReasonCode(reason);
    } else {
      shift.setVarianceReasonCode(null);
    }
    if (closedByManagerId != null) {
      shift.setClosedByManager(staffUserService.require(orgId, closedByManagerId));
    } else {
      shift.setClosedByManager(null);
    }
    return shiftRepository.save(shift);
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<Shift> getCurrentOpenShift(UUID orgId, UUID branchId, UUID terminalId) {
    branchService.require(orgId, branchId);
    Terminal terminal = terminalService.require(orgId, terminalId);
    if (!terminal.getBranch().getId().equals(branchId)) {
      return Optional.empty();
    }
    return shiftRepository.findByTerminalIdAndStatus(terminalId, ShiftStatus.OPEN);
  }

  @Override
  @Transactional(readOnly = true)
  public Shift require(UUID orgId, UUID shiftId) {
    return shiftRepository
        .findByIdAndOrgId(shiftId, orgId)
        .orElseThrow(() -> new NotFoundException("SHIFT_NOT_FOUND", "Shift not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<Shift> listByBranch(UUID orgId, UUID branchId, Pageable pageable) {
    branchService.require(orgId, branchId);
    return shiftRepository.findAllByBranchId(orgId, branchId, pageable);
  }

  @Override
  @Transactional(readOnly = true)
  public Page<Shift> listOpenByOrg(UUID orgId, Pageable pageable) {
    return shiftRepository.findAllByOrgIdAndStatus(orgId, ShiftStatus.OPEN, pageable);
  }

  @Override
  @Transactional(readOnly = true)
  public BigDecimal computeExpectedCashForOpenShift(UUID orgId, UUID shiftId) {
    return shiftExpectedCashService.computeForOpenShift(orgId, shiftId);
  }
}
