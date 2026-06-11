package com.blinc.xpos.modules.sales.service.impl;

import com.blinc.xpos.api.v1.operator.dto.CompleteWithDebtRequest;
import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.cash.domain.Shift;
import com.blinc.xpos.modules.cash.service.ShiftService;
import com.blinc.xpos.modules.debt.service.CustomerDebtService;
import com.blinc.xpos.modules.organization.domain.Customer;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.repository.StaffProfileRepository;
import com.blinc.xpos.modules.organization.service.CustomerService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import com.blinc.xpos.modules.sales.domain.Sale;
import com.blinc.xpos.modules.sales.domain.Tender;
import com.blinc.xpos.modules.sales.service.CompleteWithDebtService;
import com.blinc.xpos.modules.sales.service.SaleService;
import com.blinc.xpos.modules.sales.service.TenderService;
import java.math.BigDecimal;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CompleteWithDebtServiceImpl implements CompleteWithDebtService {

  private final SaleService saleService;
  private final TenderService tenderService;
  private final ShiftService shiftService;
  private final CustomerService customerService;
  private final CustomerDebtService customerDebtService;
  private final StaffUserService staffUserService;
  private final StaffProfileRepository staffProfileRepository;

  public CompleteWithDebtServiceImpl(
      SaleService saleService,
      TenderService tenderService,
      ShiftService shiftService,
      CustomerService customerService,
      CustomerDebtService customerDebtService,
      StaffUserService staffUserService,
      StaffProfileRepository staffProfileRepository) {
    this.saleService = Objects.requireNonNull(saleService);
    this.tenderService = Objects.requireNonNull(tenderService);
    this.shiftService = Objects.requireNonNull(shiftService);
    this.customerService = Objects.requireNonNull(customerService);
    this.customerDebtService = Objects.requireNonNull(customerDebtService);
    this.staffUserService = Objects.requireNonNull(staffUserService);
    this.staffProfileRepository = Objects.requireNonNull(staffProfileRepository);
  }

  @Override
  @Transactional
  public Sale completeWithDebt(
      UUID orgId,
      UUID branchId,
      UUID terminalId,
      UUID saleId,
      UUID staffUserId,
      CompleteWithDebtRequest request) {
    StaffUser staffUser = staffUserService.require(orgId, staffUserId);
    Shift shift =
        shiftService
            .getCurrentOpenShift(orgId, branchId, terminalId)
            .orElseThrow(
                () ->
                    new BadRequestException(
                        "SHIFT_NOT_OPEN",
                        "No open shift for this terminal. Open a shift before completing with"
                            + " debt."));

    Sale sale =
        saleService
            .getByIdAndOrg(orgId, saleId)
            .orElseThrow(
                () -> new NotFoundException("SALE_NOT_FOUND", "Sale not found: " + saleId));

    BigDecimal tenderTotal =
        tenderService.listBySale(orgId, saleId).stream()
            .map(Tender::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal remainder = sale.getTotal().subtract(tenderTotal);
    if (remainder.compareTo(BigDecimal.ZERO) <= 0) {
      throw new BadRequestException(
          "SALE_FULLY_PAID",
          "Nothing left to record as debt. The sale is fully paid — use Complete sale instead.");
    }

    Customer customer =
        customerService.create(
            orgId,
            request.customerName().trim(),
            request.customerPhone() != null ? request.customerPhone().trim() : null,
            null);

    customerDebtService.create(
        orgId,
        branchId,
        customer.getId(),
        remainder,
        request.dueDate(),
        "Balance from sale " + saleId,
        saleId,
        terminalId,
        shift.getId(),
        staffUser.getId(),
        null,
        resolveIssuedBy(orgId, staffUser, request.issuedBy()));

    return saleService.completeAllowingPartialWithDebt(orgId, saleId);
  }

  private String resolveIssuedBy(UUID orgId, StaffUser staffUser, String requestedIssuedBy) {
    if (requestedIssuedBy != null && !requestedIssuedBy.isBlank()) {
      return requestedIssuedBy.trim();
    }
    return staffProfileRepository
        .findByOrgIdAndStaffUserId(orgId, staffUser.getId())
        .map(profile -> profile.getDisplayName())
        .filter(name -> name != null && !name.isBlank())
        .orElse(staffUser.getUsername());
  }
}
