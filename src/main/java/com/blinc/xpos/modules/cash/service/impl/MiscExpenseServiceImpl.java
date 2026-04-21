package com.blinc.xpos.modules.cash.service.impl;

import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.cash.domain.MiscExpense;
import com.blinc.xpos.modules.cash.domain.Shift;
import com.blinc.xpos.modules.cash.repository.MiscExpenseRepository;
import com.blinc.xpos.modules.cash.service.MiscExpenseService;
import com.blinc.xpos.modules.cash.service.ShiftService;
import com.blinc.xpos.modules.organization.domain.Terminal;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import com.blinc.xpos.modules.organization.service.TerminalService;
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
public class MiscExpenseServiceImpl implements MiscExpenseService {

  private final MiscExpenseRepository miscExpenseRepository;
  private final BranchService branchService;
  private final StaffUserService staffUserService;
  private final TerminalService terminalService;
  private final ShiftService shiftService;
  private final Clock clock;

  public MiscExpenseServiceImpl(
      MiscExpenseRepository miscExpenseRepository,
      BranchService branchService,
      StaffUserService staffUserService,
      TerminalService terminalService,
      ShiftService shiftService,
      Clock clock) {
    this.miscExpenseRepository =
        Objects.requireNonNull(miscExpenseRepository, "miscExpenseRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.staffUserService = Objects.requireNonNull(staffUserService, "staffUserService");
    this.terminalService = Objects.requireNonNull(terminalService, "terminalService");
    this.shiftService = Objects.requireNonNull(shiftService, "shiftService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public MiscExpense create(
      UUID orgId,
      UUID branchId,
      BigDecimal amount,
      String category,
      String description,
      String incurredBy,
      String receiptRef,
      UUID terminalId,
      UUID shiftId,
      UUID createdByStaffUserId,
      Instant recordedAt) {
    var branch = branchService.require(orgId, branchId);
    var createdBy = staffUserService.require(orgId, createdByStaffUserId);

    Instant now = Instant.now(clock);
    Instant effectiveCreatedAt = now;
    if (recordedAt != null) {
      if (recordedAt.isAfter(now)) {
        throw new BadRequestException(
            "RECORDED_AT_IN_FUTURE", "Date recorded cannot be in the future.");
      }
      effectiveCreatedAt = recordedAt;
    }

    MiscExpense expense = new MiscExpense();
    expense.setOrg(branch.getOrg());
    expense.setBranch(branch);
    expense.setAmount(amount != null ? amount : BigDecimal.ZERO);
    expense.setCategory(category != null && !category.isBlank() ? category.trim() : "Other");
    expense.setDescription(description != null ? description.trim() : "");
    expense.setIncurredBy(incurredBy != null && !incurredBy.isBlank() ? incurredBy.trim() : null);
    expense.setReceiptRef(receiptRef != null && !receiptRef.isBlank() ? receiptRef.trim() : null);
    expense.setCreatedBy(createdBy);
    expense.setCreatedAt(effectiveCreatedAt);

    if (terminalId != null) {
      Terminal terminal = terminalService.require(orgId, terminalId);
      if (!terminal.getBranch().getId().equals(branchId)) {
        throw new NotFoundException(
            "TERMINAL_NOT_FOUND", "Terminal does not belong to this branch");
      }
      expense.setTerminal(terminal);
    }

    if (shiftId != null) {
      Shift shift = shiftService.require(orgId, shiftId);
      if (!shift.getBranch().getId().equals(branchId)) {
        throw new NotFoundException("SHIFT_NOT_FOUND", "Shift does not belong to this branch");
      }
      expense.setShift(shift);
    }

    return miscExpenseRepository.save(expense);
  }

  @Override
  @Transactional(readOnly = true)
  public MiscExpense require(UUID orgId, UUID expenseId) {
    return miscExpenseRepository
        .findByIdAndOrgId(expenseId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException("MISC_EXPENSE_NOT_FOUND", "Miscellaneous expense not found"));
  }

  @Override
  @Transactional
  public MiscExpense update(
      UUID orgId,
      UUID expenseId,
      BigDecimal amount,
      String category,
      String description,
      String incurredBy,
      String receiptRef,
      UUID updatedByStaffUserId) {
    staffUserService.require(orgId, updatedByStaffUserId);
    MiscExpense expense = require(orgId, expenseId);
    if (expense.getDeletedAt() != null) {
      throw new BadRequestException("EXPENSE_DELETED", "Cannot edit a deleted expense.");
    }
    expense.setAmount(amount != null ? amount : expense.getAmount());
    expense.setCategory(
        category != null && !category.isBlank() ? category.trim() : expense.getCategory());
    expense.setDescription(description != null ? description.trim() : expense.getDescription());
    expense.setIncurredBy(incurredBy != null && !incurredBy.isBlank() ? incurredBy.trim() : null);
    expense.setReceiptRef(receiptRef != null && !receiptRef.isBlank() ? receiptRef.trim() : null);
    return miscExpenseRepository.save(expense);
  }

  @Override
  @Transactional
  public MiscExpense softDelete(UUID orgId, UUID expenseId, UUID deletedByStaffUserId) {
    staffUserService.require(orgId, deletedByStaffUserId);
    MiscExpense expense = require(orgId, expenseId);
    if (expense.getDeletedAt() != null) {
      throw new BadRequestException("EXPENSE_ALREADY_DELETED", "Expense is already deleted.");
    }
    expense.setDeletedAt(Instant.now(clock));
    return miscExpenseRepository.save(expense);
  }

  @Override
  @Transactional(readOnly = true)
  public BigDecimal sumAmountByBranch(UUID orgId, UUID branchId) {
    branchService.require(orgId, branchId);
    return miscExpenseRepository.sumAmountByOrgIdAndBranchId(orgId, branchId);
  }

  @Override
  @Transactional(readOnly = true)
  public BigDecimal sumAmountByBranch(
      UUID orgId, UUID branchId, Instant fromInstant, Instant toInstant) {
    branchService.require(orgId, branchId);
    return miscExpenseRepository.sumAmountByOrgIdAndBranchIdAndDateRange(
        orgId, branchId, fromInstant, toInstant);
  }

  @Override
  @Transactional(readOnly = true)
  public Page<MiscExpense> listByBranch(UUID orgId, UUID branchId, Pageable pageable) {
    branchService.require(orgId, branchId);
    return miscExpenseRepository.findAllByOrgIdAndBranchId(orgId, branchId, pageable);
  }

  @Override
  @Transactional(readOnly = true)
  public Page<MiscExpense> listByBranch(
      UUID orgId, UUID branchId, Instant fromInstant, Instant toInstant, Pageable pageable) {
    branchService.require(orgId, branchId);
    return miscExpenseRepository.findAllByOrgIdAndBranchIdAndCreatedAtBetween(
        orgId, branchId, fromInstant, toInstant, pageable);
  }

  @Override
  @Transactional(readOnly = true)
  public List<String> listCategoriesByOrg(UUID orgId) {
    return miscExpenseRepository.findDistinctCategoriesByOrgId(orgId);
  }
}
