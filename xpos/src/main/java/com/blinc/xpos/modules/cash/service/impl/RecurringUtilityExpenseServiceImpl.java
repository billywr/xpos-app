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
import java.time.LocalDate;
import java.time.YearMonth;
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
      LocalDate effectiveFrom,
      LocalDate effectiveTo,
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
    LocalDate start =
        effectiveFrom != null
            ? YearMonth.from(effectiveFrom).atDay(1)
            : LocalDate.now().withDayOfMonth(1);
    if (effectiveTo != null && YearMonth.from(effectiveTo).isBefore(YearMonth.from(start))) {
      throw new BadRequestException(
          "INVALID_EFFECTIVE_PERIOD",
          "Effective to month cannot be earlier than effective from month.");
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
    utility.setEffectiveFrom(start);
    utility.setEffectiveTo(effectiveTo != null ? YearMonth.from(effectiveTo).atEndOfMonth() : null);
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
      LocalDate effectiveFrom,
      LocalDate effectiveTo,
      Boolean isRateChange,
      RecurringUtilityApplyTiming applyTiming,
      Integer dueDayOfMonth,
      String payee,
      String accountNumber,
      String incurredBy,
      Boolean active,
      String notes,
      UUID updatedByStaffUserId) {
    StaffUser staffUser = staffUserService.require(orgId, updatedByStaffUserId);
    RecurringUtilityExpense utility = require(orgId, branchId, utilityId);

    validateUpdateInputs(name, amount, dueDayOfMonth);

    LocalDate currentEffectiveFrom = utility.getEffectiveFrom();
    if (currentEffectiveFrom == null) {
      currentEffectiveFrom =
          utility.getCreatedAt() != null
              ? utility
                  .getCreatedAt()
                  .atZone(java.time.ZoneId.systemDefault())
                  .toLocalDate()
                  .withDayOfMonth(1)
              : LocalDate.now().withDayOfMonth(1);
      utility.setEffectiveFrom(currentEffectiveFrom);
    }

    boolean rateChange =
        Boolean.TRUE.equals(isRateChange)
            || (isRateChange == null
                && effectiveFrom != null
                && YearMonth.from(effectiveFrom).isAfter(YearMonth.from(currentEffectiveFrom)));

    if (rateChange && effectiveFrom != null) {
      return createRateChangeRecord(
          utility,
          name,
          amount,
          effectiveFrom,
          effectiveTo,
          applyTiming,
          dueDayOfMonth,
          payee,
          accountNumber,
          incurredBy,
          active,
          notes,
          staffUser);
    }

    if (name != null) {
      utility.setName(name.trim());
    }
    if (amount != null) {
      utility.setAmount(amount);
    }
    if (effectiveFrom != null) {
      utility.setEffectiveFrom(YearMonth.from(effectiveFrom).atDay(1));
    }
    if (effectiveTo != null) {
      LocalDate activeFrom = utility.getEffectiveFrom();
      if (activeFrom != null && YearMonth.from(effectiveTo).isBefore(YearMonth.from(activeFrom))) {
        throw new BadRequestException(
            "INVALID_EFFECTIVE_PERIOD",
            "Effective to month cannot be earlier than effective from month.");
      }
      utility.setEffectiveTo(YearMonth.from(effectiveTo).atEndOfMonth());
    } else if (effectiveFrom != null) {
      utility.setEffectiveTo(null);
    }
    if (applyTiming != null) {
      utility.setApplyTiming(applyTiming);
    }
    if (dueDayOfMonth != null) {
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

  private void validateUpdateInputs(String name, BigDecimal amount, Integer dueDayOfMonth) {
    if (name != null && name.isBlank()) {
      throw new BadRequestException("INVALID_NAME", "Utility name cannot be blank.");
    }
    if (amount != null && amount.compareTo(BigDecimal.ZERO) <= 0) {
      throw new BadRequestException("INVALID_AMOUNT", "Amount must be greater than zero.");
    }
    if (dueDayOfMonth != null && (dueDayOfMonth < 1 || dueDayOfMonth > 31)) {
      throw new BadRequestException(
          "INVALID_DUE_DAY", "Due day of month must be between 1 and 31.");
    }
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
  public List<RecurringUtilityExpense> listApplicableForPeriod(
      UUID orgId, UUID branchId, LocalDate startDate, LocalDate endDate) {
    branchService.require(orgId, branchId);
    return repository.findApplicableForPeriod(orgId, branchId, startDate, endDate);
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

  private RecurringUtilityExpense createRateChangeRecord(
      RecurringUtilityExpense utility,
      String name,
      BigDecimal amount,
      LocalDate effectiveFrom,
      LocalDate effectiveTo,
      RecurringUtilityApplyTiming applyTiming,
      Integer dueDayOfMonth,
      String payee,
      String accountNumber,
      String incurredBy,
      Boolean active,
      String notes,
      StaffUser staffUser) {
    LocalDate normalizedEffectiveFrom = YearMonth.from(effectiveFrom).atDay(1);
    if (effectiveTo != null
        && YearMonth.from(effectiveTo).isBefore(YearMonth.from(normalizedEffectiveFrom))) {
      throw new BadRequestException(
          "INVALID_EFFECTIVE_PERIOD",
          "Effective to month cannot be earlier than effective from month.");
    }
    LocalDate previousEffectiveTo = YearMonth.from(effectiveFrom).minusMonths(1).atEndOfMonth();
    utility.setEffectiveTo(previousEffectiveTo);
    utility.setActive(false);
    repository.save(utility);

    RecurringUtilityExpense next = new RecurringUtilityExpense();
    next.setOrg(utility.getOrg());
    next.setBranch(utility.getBranch());
    next.setName(name != null && !name.isBlank() ? name.trim() : utility.getName());
    next.setAmount(amount != null ? amount : utility.getAmount());
    next.setEffectiveFrom(normalizedEffectiveFrom);
    next.setEffectiveTo(effectiveTo != null ? YearMonth.from(effectiveTo).atEndOfMonth() : null);
    next.setApplyTiming(applyTiming != null ? applyTiming : utility.getApplyTiming());
    next.setDueDayOfMonth(dueDayOfMonth != null ? dueDayOfMonth : utility.getDueDayOfMonth());
    next.setPayee(payee != null ? (!payee.isBlank() ? payee.trim() : null) : utility.getPayee());
    next.setAccountNumber(
        accountNumber != null
            ? (!accountNumber.isBlank() ? accountNumber.trim() : null)
            : utility.getAccountNumber());
    next.setIncurredBy(
        incurredBy != null
            ? (!incurredBy.isBlank() ? incurredBy.trim() : null)
            : utility.getIncurredBy());
    next.setActive(active != null ? active : true);
    next.setNotes(notes != null ? (!notes.isBlank() ? notes.trim() : null) : utility.getNotes());
    next.setCreatedBy(staffUser);
    return repository.save(next);
  }
}
