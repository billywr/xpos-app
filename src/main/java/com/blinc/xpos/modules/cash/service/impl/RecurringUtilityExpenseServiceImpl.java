package com.blinc.xpos.modules.cash.service.impl;

import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.cash.domain.RecurringUtilityApplyTiming;
import com.blinc.xpos.modules.cash.domain.RecurringUtilityExpense;
import com.blinc.xpos.modules.cash.repository.RecurringUtilityExpenseRepository;
import com.blinc.xpos.modules.cash.service.RecurringUtilityExpenseService;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RecurringUtilityExpenseServiceImpl implements RecurringUtilityExpenseService {

  private final RecurringUtilityExpenseRepository repository;
  private final BranchService branchService;
  private final StaffUserService staffUserService;

  public RecurringUtilityExpenseServiceImpl(
      RecurringUtilityExpenseRepository repository,
      BranchService branchService,
      StaffUserService staffUserService) {
    this.repository = Objects.requireNonNull(repository, "repository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.staffUserService = Objects.requireNonNull(staffUserService, "staffUserService");
  }

  @Override
  @Transactional
  public RecurringUtilityExpense create(
      UUID orgId,
      UUID branchId,
      String name,
      BigDecimal amount,
      RecurringUtilityApplyTiming applyTiming,
      Integer dueDayOfMonth,
      String payee,
      String accountNumber,
      String incurredBy,
      String notes,
      UUID createdByStaffUserId) {
    Branch branch = branchService.require(orgId, branchId);
    Org org = branch.getOrg();
    StaffUser createdBy = staffUserService.require(orgId, createdByStaffUserId);

    if (name == null || name.isBlank()) {
      throw new BadRequestException("INVALID_NAME", "Utility name is required.");
    }
    if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
      throw new BadRequestException("INVALID_AMOUNT", "Amount must be greater than zero.");
    }
    int day = dueDayOfMonth != null ? dueDayOfMonth : 1;
    if (day < 1 || day > 31) {
      throw new BadRequestException(
          "INVALID_DUE_DAY", "Due day of month must be between 1 and 31.");
    }

    RecurringUtilityExpense utility = new RecurringUtilityExpense();
    utility.setOrg(org);
    utility.setBranch(branch);
    utility.setName(name.trim());
    utility.setAmount(amount);
    utility.setApplyTiming(
        applyTiming != null ? applyTiming : RecurringUtilityApplyTiming.BEGINNING_OF_MONTH);
    utility.setDueDayOfMonth(day);
    utility.setPayee(payee != null && !payee.isBlank() ? payee.trim() : null);
    utility.setAccountNumber(
        accountNumber != null && !accountNumber.isBlank() ? accountNumber.trim() : null);
    utility.setIncurredBy(incurredBy != null && !incurredBy.isBlank() ? incurredBy.trim() : null);
    utility.setNotes(notes != null && !notes.isBlank() ? notes.trim() : null);
    utility.setActive(true);
    utility.setCreatedBy(createdBy);

    return repository.save(utility);
  }

  @Override
  @Transactional(readOnly = true)
  public RecurringUtilityExpense require(UUID orgId, UUID branchId, UUID utilityId) {
    return repository
        .findByIdAndOrgIdAndBranchId(utilityId, orgId, branchId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "RECURRING_UTILITY_NOT_FOUND", "Recurring utility bill not found."));
  }

  @Override
  @Transactional
  public RecurringUtilityExpense update(
      UUID orgId,
      UUID branchId,
      UUID utilityId,
      String name,
      BigDecimal amount,
      RecurringUtilityApplyTiming applyTiming,
      Integer dueDayOfMonth,
      String payee,
      String accountNumber,
      String incurredBy,
      Boolean active,
      String notes,
      UUID updatedByStaffUserId) {
    staffUserService.require(orgId, updatedByStaffUserId);
    RecurringUtilityExpense utility = require(orgId, branchId, utilityId);

    if (name != null) {
      if (name.isBlank()) {
        throw new BadRequestException("INVALID_NAME", "Utility name cannot be blank.");
      }
      utility.setName(name.trim());
    }
    if (amount != null) {
      if (amount.compareTo(BigDecimal.ZERO) <= 0) {
        throw new BadRequestException("INVALID_AMOUNT", "Amount must be greater than zero.");
      }
      utility.setAmount(amount);
    }
    if (applyTiming != null) {
      utility.setApplyTiming(applyTiming);
    }
    if (dueDayOfMonth != null) {
      if (dueDayOfMonth < 1 || dueDayOfMonth > 31) {
        throw new BadRequestException(
            "INVALID_DUE_DAY", "Due day of month must be between 1 and 31.");
      }
      utility.setDueDayOfMonth(dueDayOfMonth);
    }
    if (payee != null) {
      utility.setPayee(!payee.isBlank() ? payee.trim() : null);
    }
    if (accountNumber != null) {
      utility.setAccountNumber(!accountNumber.isBlank() ? accountNumber.trim() : null);
    }
    if (incurredBy != null) {
      utility.setIncurredBy(!incurredBy.isBlank() ? incurredBy.trim() : null);
    }
    if (active != null) {
      utility.setActive(active);
    }
    if (notes != null) {
      utility.setNotes(!notes.isBlank() ? notes.trim() : null);
    }

    return repository.save(utility);
  }

  @Override
  @Transactional
  public void softDelete(UUID orgId, UUID branchId, UUID utilityId, UUID deletedByStaffUserId) {
    staffUserService.require(orgId, deletedByStaffUserId);
    RecurringUtilityExpense utility = require(orgId, branchId, utilityId);
    utility.setDeletedAt(Instant.now());
    utility.setActive(false);
    repository.save(utility);
  }

  @Override
  @Transactional(readOnly = true)
  public Page<RecurringUtilityExpense> list(
      UUID orgId, UUID branchId, Boolean active, String query, Pageable pageable) {
    branchService.require(orgId, branchId);
    String normalizedQuery = (query != null && !query.isBlank()) ? query.trim() : null;
    String pattern = normalizedQuery != null ? "%" + normalizedQuery.toLowerCase() + "%" : null;
    return repository.findAllByOrgIdAndBranchIdAndFilter(
        orgId, branchId, active, pattern, pageable);
  }

  @Override
  @Transactional(readOnly = true)
  public List<RecurringUtilityExpense> listAllActive(UUID orgId, UUID branchId) {
    branchService.require(orgId, branchId);
    return repository.findAllActiveByOrgIdAndBranchId(orgId, branchId);
  }

  @Override
  @Transactional(readOnly = true)
  public BigDecimal sumActiveMonthlyAmount(UUID orgId, UUID branchId) {
    branchService.require(orgId, branchId);
    return repository.sumActiveMonthlyAmountByOrgIdAndBranchId(orgId, branchId);
  }

  @Override
  @Transactional(readOnly = true)
  public long countActive(UUID orgId, UUID branchId) {
    branchService.require(orgId, branchId);
    return repository.countActiveByOrgIdAndBranchId(orgId, branchId);
  }
}
