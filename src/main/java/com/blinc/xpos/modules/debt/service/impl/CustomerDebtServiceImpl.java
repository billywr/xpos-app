package com.blinc.xpos.modules.debt.service.impl;

import com.blinc.xpos.common.constants.enums.CustomerDebtStatus;
import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.cash.domain.Shift;
import com.blinc.xpos.modules.cash.service.ShiftService;
import com.blinc.xpos.modules.debt.domain.CustomerDebt;
import com.blinc.xpos.modules.debt.repository.CustomerDebtRepository;
import com.blinc.xpos.modules.debt.service.CustomerDebtService;
import com.blinc.xpos.modules.debt.service.DebtUpdateInput;
import com.blinc.xpos.modules.organization.domain.Customer;
import com.blinc.xpos.modules.organization.domain.Terminal;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.CustomerService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import com.blinc.xpos.modules.organization.service.TerminalService;
import com.blinc.xpos.modules.sales.domain.Sale;
import com.blinc.xpos.modules.sales.service.SaleService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerDebtServiceImpl implements CustomerDebtService {

  private static final String DEFAULT_CURRENCY = "KES";

  private final CustomerDebtRepository customerDebtRepository;
  private final CustomerService customerService;
  private final BranchService branchService;
  private final StaffUserService staffUserService;
  private final ShiftService shiftService;
  private final TerminalService terminalService;
  private final SaleService saleService;
  private final Clock clock;

  public CustomerDebtServiceImpl(
      CustomerDebtRepository customerDebtRepository,
      CustomerService customerService,
      BranchService branchService,
      StaffUserService staffUserService,
      ShiftService shiftService,
      TerminalService terminalService,
      SaleService saleService,
      Clock clock) {
    this.customerDebtRepository =
        Objects.requireNonNull(customerDebtRepository, "customerDebtRepository");
    this.customerService = Objects.requireNonNull(customerService, "customerService");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.staffUserService = Objects.requireNonNull(staffUserService, "staffUserService");
    this.shiftService = Objects.requireNonNull(shiftService, "shiftService");
    this.terminalService = Objects.requireNonNull(terminalService, "terminalService");
    this.saleService = Objects.requireNonNull(saleService, "saleService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public CustomerDebt create(
      UUID orgId,
      UUID branchId,
      UUID customerId,
      BigDecimal amount,
      LocalDate dueDate,
      String notes,
      UUID saleId,
      UUID terminalId,
      UUID shiftId,
      UUID createdByStaffUserId,
      Instant recordedAt) {
    branchService.require(orgId, branchId);
    Customer customer = customerService.require(orgId, customerId);
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

    CustomerDebt debt = new CustomerDebt();
    debt.setOrg(customer.getOrg());
    debt.setBranch(branchService.require(orgId, branchId));
    debt.setCustomer(customer);
    debt.setAmount(amount != null ? amount : BigDecimal.ZERO);
    debt.setAmountSettled(BigDecimal.ZERO);
    debt.setCurrency(DEFAULT_CURRENCY);
    debt.setDueDate(dueDate);
    debt.setStatus(CustomerDebtStatus.OPEN);
    debt.setNotes(notes != null ? notes.trim() : null);
    debt.setCreatedBy(createdBy);
    debt.setCreatedAt(effectiveCreatedAt);

    if (saleId != null) {
      Sale sale =
          saleService
              .getByIdAndOrg(orgId, saleId)
              .orElseThrow(() -> new NotFoundException("SALE_NOT_FOUND", "Sale not found"));
      if (!sale.getBranch().getId().equals(branchId)) {
        throw new NotFoundException("SALE_NOT_FOUND", "Sale does not belong to this branch");
      }
      debt.setSale(sale);
    }

    if (terminalId != null) {
      Terminal terminal = terminalService.require(orgId, terminalId);
      if (!terminal.getBranch().getId().equals(branchId)) {
        throw new NotFoundException(
            "TERMINAL_NOT_FOUND", "Terminal does not belong to this branch");
      }
      debt.setTerminal(terminal);
    }

    if (shiftId != null) {
      Shift shift = shiftService.require(orgId, shiftId);
      if (!shift.getBranch().getId().equals(branchId)) {
        throw new NotFoundException("SHIFT_NOT_FOUND", "Shift does not belong to this branch");
      }
      debt.setShift(shift);
    }

    return customerDebtRepository.save(debt);
  }

  @Override
  @Transactional(readOnly = true)
  public CustomerDebt require(UUID orgId, UUID debtId) {
    return customerDebtRepository
        .findByIdAndOrgId(debtId, orgId)
        .orElseThrow(
            () -> new NotFoundException("CUSTOMER_DEBT_NOT_FOUND", "Customer debt not found"));
  }

  @Override
  @Transactional
  public CustomerDebt update(
      UUID orgId, UUID debtId, DebtUpdateInput input, UUID updatedByStaffUserId) {
    staffUserService.require(orgId, updatedByStaffUserId);
    CustomerDebt debt = require(orgId, debtId);

    // Customer name/phone edits are typo-fixes and are always allowed — they
    // don't change any financial state on the debt itself, only update the
    // linked customer record. Do this first, before any status gates, so they
    // work on SETTLED, CANCELLED, or debts with recorded repayments.
    if (input.customerName() != null || input.customerPhone() != null) {
      String name = input.customerName();
      if (name != null && name.trim().isEmpty()) {
        throw new BadRequestException("CUSTOMER_NAME_REQUIRED", "Customer name cannot be empty.");
      }
      String phone = input.customerPhone();
      if (phone != null) {
        phone = phone.trim();
      }
      customerService.update(orgId, debt.getCustomer().getId(), name, phone, null, null);
    }

    boolean touchesFinancials =
        input.reassignedCustomerId() != null
            || input.amount() != null
            || input.outstanding() != null
            || input.dueDate() != null
            || input.notes() != null;
    if (!touchesFinancials) {
      return customerDebtRepository.save(debt);
    }

    if (debt.getStatus() == CustomerDebtStatus.CANCELLED) {
      throw new BadRequestException("DEBT_CANCELLED", "Cannot update a cancelled debt.");
    }
    if (debt.getStatus() == CustomerDebtStatus.SETTLED) {
      throw new BadRequestException("DEBT_SETTLED", "Cannot update a settled debt.");
    }
    BigDecimal currentSettled =
        debt.getAmountSettled() != null ? debt.getAmountSettled() : BigDecimal.ZERO;
    if (currentSettled.compareTo(BigDecimal.ZERO) > 0) {
      throw new BadRequestException(
          "DEBT_HAS_REPAYMENTS",
          "Cannot edit debt once repayments have been recorded. Use Record payment to add more.");
    }
    if (input.reassignedCustomerId() != null) {
      debt.setCustomer(customerService.require(orgId, input.reassignedCustomerId()));
    }
    if (input.amount() != null) {
      if (input.amount().compareTo(BigDecimal.ZERO) <= 0) {
        throw new BadRequestException("INVALID_AMOUNT", "Amount must be positive.");
      }
      BigDecimal settled =
          debt.getAmountSettled() != null ? debt.getAmountSettled() : BigDecimal.ZERO;
      if (input.amount().compareTo(settled) < 0) {
        throw new BadRequestException(
            "AMOUNT_BELOW_SETTLED", "Original amount cannot be less than amount already repaid.");
      }
      debt.setAmount(input.amount());
    }
    if (input.outstanding() != null) {
      BigDecimal orig = debt.getAmount() != null ? debt.getAmount() : BigDecimal.ZERO;
      BigDecimal outstanding = input.outstanding();
      if (outstanding.compareTo(BigDecimal.ZERO) < 0) {
        throw new BadRequestException("BALANCE_NEGATIVE", "Balance cannot be negative.");
      }
      if (outstanding.compareTo(orig) > 0) {
        throw new BadRequestException(
            "BALANCE_EXCEEDS_ORIGINAL", "Balance cannot exceed the original debt.");
      }
      BigDecimal newSettled = orig.subtract(outstanding);
      debt.setAmountSettled(newSettled);
      debt.setStatus(
          outstanding.compareTo(BigDecimal.ZERO) <= 0
              ? CustomerDebtStatus.SETTLED
              : newSettled.compareTo(BigDecimal.ZERO) > 0
                  ? CustomerDebtStatus.PARTIAL
                  : CustomerDebtStatus.OPEN);
    }
    if (input.dueDate() != null) {
      debt.setDueDate(input.dueDate());
    }
    if (input.notes() != null) {
      String n = input.notes().trim();
      debt.setNotes(n.isEmpty() ? null : n);
    }
    return customerDebtRepository.save(debt);
  }

  @Override
  @Transactional
  public CustomerDebt cancel(UUID orgId, UUID debtId, UUID cancelledByStaffUserId) {
    var cancelledBy = staffUserService.require(orgId, cancelledByStaffUserId);
    CustomerDebt debt = require(orgId, debtId);
    if (debt.getStatus() == CustomerDebtStatus.CANCELLED) {
      throw new BadRequestException("DEBT_ALREADY_CANCELLED", "Debt is already cancelled.");
    }
    BigDecimal currentSettled =
        debt.getAmountSettled() != null ? debt.getAmountSettled() : BigDecimal.ZERO;
    if (currentSettled.compareTo(BigDecimal.ZERO) > 0) {
      throw new BadRequestException(
          "DEBT_HAS_REPAYMENTS", "Cannot clear debt once repayments have been recorded.");
    }
    debt.setStatus(CustomerDebtStatus.CANCELLED);
    debt.setCancelledAt(Instant.now(clock));
    debt.setCancelledBy(cancelledBy);
    return customerDebtRepository.save(debt);
  }

  @Override
  @Transactional
  public void cancelDebtsForSale(UUID orgId, UUID saleId, UUID cancelledByStaffUserId) {
    List<CustomerDebt> debts = customerDebtRepository.findAllBySaleIdAndOrgId(saleId, orgId);
    for (CustomerDebt debt : debts) {
      if (debt.getStatus() == CustomerDebtStatus.CANCELLED
          || debt.getStatus() == CustomerDebtStatus.SETTLED) {
        continue;
      }
      BigDecimal settled =
          debt.getAmountSettled() != null ? debt.getAmountSettled() : BigDecimal.ZERO;
      if (settled.compareTo(BigDecimal.ZERO) > 0) {
        throw new BadRequestException(
            "DEBT_HAS_REPAYMENTS",
            "Cannot refund sale: linked debt has repayments. Settle or clear debt first.");
      }
      cancel(orgId, debt.getId(), cancelledByStaffUserId);
    }
  }

  @Override
  @Transactional
  public CustomerDebt settle(
      UUID orgId, UUID debtId, BigDecimal paymentAmount, UUID settledByStaffUserId) {
    staffUserService.require(orgId, settledByStaffUserId);
    CustomerDebt debt = require(orgId, debtId);
    if (debt.getStatus() == CustomerDebtStatus.CANCELLED) {
      throw new BadRequestException("DEBT_CANCELLED", "Cannot settle a cancelled debt.");
    }
    if (debt.getStatus() == CustomerDebtStatus.SETTLED) {
      throw new BadRequestException("DEBT_ALREADY_SETTLED", "Debt is already fully settled.");
    }
    if (paymentAmount == null || paymentAmount.compareTo(BigDecimal.ZERO) <= 0) {
      throw new BadRequestException("INVALID_PAYMENT", "Payment amount must be positive.");
    }
    BigDecimal newSettled =
        (debt.getAmountSettled() != null ? debt.getAmountSettled() : BigDecimal.ZERO)
            .add(paymentAmount);
    if (newSettled.compareTo(debt.getAmount()) > 0) {
      throw new BadRequestException(
          "PAYMENT_EXCEEDS_DEBT", "Payment exceeds the outstanding amount.");
    }
    debt.setAmountSettled(newSettled);
    debt.setStatus(
        newSettled.compareTo(debt.getAmount()) >= 0
            ? CustomerDebtStatus.SETTLED
            : CustomerDebtStatus.PARTIAL);
    return customerDebtRepository.save(debt);
  }

  @Override
  @Transactional(readOnly = true)
  public Page<CustomerDebt> listByBranch(UUID orgId, UUID branchId, Pageable pageable) {
    return listByBranch(orgId, branchId, null, pageable);
  }

  @Override
  @Transactional(readOnly = true)
  public Page<CustomerDebt> listByBranch(
      UUID orgId, UUID branchId, List<CustomerDebtStatus> statuses, Pageable pageable) {
    return listByBranch(orgId, branchId, statuses, null, null, pageable);
  }

  @Override
  @Transactional(readOnly = true)
  public Page<CustomerDebt> listByBranch(
      UUID orgId,
      UUID branchId,
      List<CustomerDebtStatus> statuses,
      Instant fromInstant,
      Instant toInstant,
      Pageable pageable) {
    branchService.require(orgId, branchId);
    boolean hasStatuses = statuses != null && !statuses.isEmpty();
    boolean hasDates = fromInstant != null && toInstant != null;

    if (hasStatuses && hasDates) {
      List<String> statusNames = statuses.stream().map(Enum::name).toList();
      return customerDebtRepository.findAllByOrgIdAndBranchIdAndStatusInAndCreatedAtBetween(
          orgId, branchId, statusNames, fromInstant, toInstant, pageable);
    }
    if (hasStatuses) {
      List<String> statusNames = statuses.stream().map(Enum::name).toList();
      return customerDebtRepository.findAllByOrgIdAndBranchIdAndStatusIn(
          orgId, branchId, statusNames, pageable);
    }
    if (hasDates) {
      return customerDebtRepository.findAllByOrgIdAndBranchIdAndCreatedAtBetween(
          orgId, branchId, fromInstant, toInstant, pageable);
    }
    return customerDebtRepository.findAllByOrgIdAndBranchId(orgId, branchId, pageable);
  }

  @Override
  @Transactional(readOnly = true)
  public BigDecimal sumPendingOutstanding(UUID orgId, UUID branchId) {
    branchService.require(orgId, branchId);
    BigDecimal v =
        customerDebtRepository.sumOutstandingByOrgIdAndBranchIdAndStatusIn(
            orgId, branchId, List.of("OPEN", "PARTIAL"));
    return v != null ? v : BigDecimal.ZERO;
  }

  @Override
  @Transactional(readOnly = true)
  public Page<CustomerDebt> listByCustomer(UUID orgId, UUID customerId, Pageable pageable) {
    customerService.require(orgId, customerId);
    return customerDebtRepository.findAllByOrgIdAndCustomerId(orgId, customerId, pageable);
  }
}
