package com.blinc.xpos.modules.cash.service.impl;

import com.blinc.xpos.common.constants.enums.CashMovementType;
import com.blinc.xpos.common.constants.enums.ShiftStatus;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.cash.domain.CashMovement;
import com.blinc.xpos.modules.cash.domain.Shift;
import com.blinc.xpos.modules.cash.repository.CashMovementRepository;
import com.blinc.xpos.modules.cash.service.CashMovementService;
import com.blinc.xpos.modules.cash.service.ShiftService;
import com.blinc.xpos.modules.ledger.service.LedgerPostingService;
import com.blinc.xpos.modules.fraud.domain.ReasonCode;
import com.blinc.xpos.modules.fraud.repository.ReasonCodeRepository;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CashMovementServiceImpl implements CashMovementService {

  private final CashMovementRepository cashMovementRepository;
  private final ShiftService shiftService;
  private final BranchService branchService;
  private final StaffUserService staffUserService;
  private final ReasonCodeRepository reasonCodeRepository;
  private final LedgerPostingService ledgerPostingService;
  private final Clock clock;

  public CashMovementServiceImpl(
      CashMovementRepository cashMovementRepository,
      ShiftService shiftService,
      BranchService branchService,
      StaffUserService staffUserService,
      ReasonCodeRepository reasonCodeRepository,
      LedgerPostingService ledgerPostingService,
      Clock clock) {
    this.cashMovementRepository =
        Objects.requireNonNull(cashMovementRepository, "cashMovementRepository");
    this.shiftService = Objects.requireNonNull(shiftService, "shiftService");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.staffUserService = Objects.requireNonNull(staffUserService, "staffUserService");
    this.reasonCodeRepository =
        Objects.requireNonNull(reasonCodeRepository, "reasonCodeRepository");
    this.ledgerPostingService =
        Objects.requireNonNull(ledgerPostingService, "ledgerPostingService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public CashMovement create(
      UUID orgId,
      UUID branchId,
      UUID terminalId,
      UUID shiftId,
      CashMovementType type,
      BigDecimal amount,
      UUID reasonCodeId,
      UUID createdByStaffUserId) {
    branchService.require(orgId, branchId);
    Shift shift = shiftService.require(orgId, shiftId);
    if (shift.getStatus() != ShiftStatus.OPEN) {
      throw new IllegalStateException("Cash movement only allowed when shift is open.");
    }
    if (!shift.getTerminal().getId().equals(terminalId)) {
      throw new NotFoundException(
          "SHIFT_NOT_FOUND", "Shift does not belong to this terminal");
    }
    if (!shift.getBranch().getId().equals(branchId)) {
      throw new NotFoundException(
          "SHIFT_NOT_FOUND", "Shift does not belong to this branch");
    }
    var createdBy = staffUserService.require(orgId, createdByStaffUserId);
    CashMovement movement = new CashMovement();
    movement.setOrg(shift.getOrg());
    movement.setBranch(shift.getBranch());
    movement.setTerminal(shift.getTerminal());
    movement.setShift(shift);
    movement.setType(type);
    movement.setAmount(amount != null ? amount : BigDecimal.ZERO);
    if (reasonCodeId != null) {
      ReasonCode reason =
          reasonCodeRepository
              .findByIdAndOrgId(reasonCodeId, orgId)
              .orElseThrow(
                  () ->
                      new NotFoundException(
                          "REASON_CODE_NOT_FOUND", "Reason code not found"));
      movement.setReasonCode(reason);
    } else {
      movement.setReasonCode(null);
    }
    movement.setCreatedBy(createdBy);
    movement.setCreatedAt(Instant.now(clock));
    CashMovement saved = cashMovementRepository.save(movement);
    ledgerPostingService.postCashMovement(orgId, saved);
    return saved;
  }

  @Override
  @Transactional(readOnly = true)
  public CashMovement require(UUID orgId, UUID cashMovementId) {
    return cashMovementRepository
        .findByIdAndOrgId(cashMovementId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "CASH_MOVEMENT_NOT_FOUND", "Cash movement not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public List<CashMovement> listByShift(UUID orgId, UUID shiftId) {
    shiftService.require(orgId, shiftId);
    return cashMovementRepository.findAllByShiftId(shiftId);
  }

  @Override
  @Transactional(readOnly = true)
  public Page<CashMovement> listByBranch(UUID orgId, UUID branchId, Pageable pageable) {
    branchService.require(orgId, branchId);
    return cashMovementRepository.findAllByBranchId(branchId, pageable);
  }
}
