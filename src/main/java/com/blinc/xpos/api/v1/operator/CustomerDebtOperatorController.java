package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.api.v1.operator.dto.CustomerDebtCreateRequest;
import com.blinc.xpos.api.v1.operator.dto.CustomerDebtResponse;
import com.blinc.xpos.api.v1.operator.dto.CustomerDebtUpdateRequest;
import com.blinc.xpos.api.v1.operator.dto.DebtBulkSettleAllocationLineDto;
import com.blinc.xpos.api.v1.operator.dto.DebtBulkSettleByNameRequest;
import com.blinc.xpos.api.v1.operator.dto.DebtBulkSettleResponse;
import com.blinc.xpos.api.v1.operator.dto.DebtPendingTotalResponse;
import com.blinc.xpos.api.v1.operator.dto.DebtSettleRequest;
import com.blinc.xpos.common.constants.enums.CustomerDebtStatus;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.debt.domain.CustomerDebt;
import com.blinc.xpos.modules.debt.dto.CustomerDebtBulkSettleAllocation;
import com.blinc.xpos.modules.debt.dto.CustomerDebtBulkSettleResult;
import com.blinc.xpos.modules.debt.service.CustomerDebtService;
import com.blinc.xpos.modules.debt.service.DebtUpdateInput;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/operator/orgs/{orgId}/branches/{branchId}")
public class CustomerDebtOperatorController {

  private final CustomerDebtService customerDebtService;
  private final PageRequestFactory pageRequestFactory;
  private final CurrentPrincipalResolver principalResolver;
  private final StaffAuthorizationService staffAuthorizationService;

  public CustomerDebtOperatorController(
      CustomerDebtService customerDebtService,
      PageRequestFactory pageRequestFactory,
      CurrentPrincipalResolver principalResolver,
      StaffAuthorizationService staffAuthorizationService) {
    this.customerDebtService = Objects.requireNonNull(customerDebtService, "customerDebtService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
  }

  @PostMapping("/debts")
  @ResponseStatus(HttpStatus.CREATED)
  public CustomerDebtResponse create(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @Valid @RequestBody CustomerDebtCreateRequest request) {
    var staffUser =
        staffAuthorizationService.requireStaffUserForBranch(
            orgId, branchId, principalResolver.require().iamUserId());
    CustomerDebt debt =
        customerDebtService.create(
            orgId,
            branchId,
            request.customerId(),
            request.amount(),
            request.dueDate(),
            request.notes(),
            request.saleId(),
            request.terminalId(),
            request.shiftId(),
            staffUser.getId(),
            request.createdAt(),
            request.issuedBy());
    return toResponse(debt);
  }

  @PatchMapping("/debts/{debtId}")
  public CustomerDebtResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID debtId,
      @Valid @RequestBody CustomerDebtUpdateRequest request) {
    var staffUser =
        staffAuthorizationService.requireStaffUserForBranch(
            orgId, branchId, principalResolver.require().iamUserId());
    CustomerDebt debt =
        customerDebtService.update(
            orgId,
            debtId,
            new DebtUpdateInput(
                request.customerId(),
                request.customerName(),
                request.customerPhone(),
                request.amount(),
                request.outstanding(),
                request.dueDate(),
                request.notes(),
                request.issuedBy()),
            staffUser.getId());
    return toResponse(debt);
  }

  @PostMapping("/debts/{debtId}/cancel")
  public CustomerDebtResponse cancel(
      @PathVariable UUID orgId, @PathVariable UUID branchId, @PathVariable UUID debtId) {
    var staffUser =
        staffAuthorizationService.requireStaffUserForBranch(
            orgId, branchId, principalResolver.require().iamUserId());
    CustomerDebt debt = customerDebtService.cancel(orgId, debtId, staffUser.getId());
    return toResponse(debt);
  }

  @PostMapping("/debts/{debtId}/settle")
  public CustomerDebtResponse settle(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID debtId,
      @Valid @RequestBody DebtSettleRequest request) {
    var staffUser =
        staffAuthorizationService.requireStaffUserForBranch(
            orgId, branchId, principalResolver.require().iamUserId());
    CustomerDebt debt =
        customerDebtService.settle(orgId, debtId, request.paymentAmount(), staffUser.getId());
    return toResponse(debt);
  }

  @PostMapping("/customers/{customerId}/debts/settle-bulk")
  public DebtBulkSettleResponse settleBulk(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID customerId,
      @Valid @RequestBody DebtSettleRequest request) {
    var staffUser =
        staffAuthorizationService.requireStaffUserForBranch(
            orgId, branchId, principalResolver.require().iamUserId());
    CustomerDebtBulkSettleResult result =
        customerDebtService.settleCustomerDebts(
            orgId, branchId, customerId, request.paymentAmount(), staffUser.getId());
    return toBulkSettleResponse(result);
  }

  @PostMapping("/debts/settle-bulk-by-name")
  public DebtBulkSettleResponse settleBulkByName(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @Valid @RequestBody DebtBulkSettleByNameRequest request) {
    var staffUser =
        staffAuthorizationService.requireStaffUserForBranch(
            orgId, branchId, principalResolver.require().iamUserId());
    CustomerDebtBulkSettleResult result =
        customerDebtService.settleCustomerDebtsByName(
            orgId, branchId, request.customerName(), request.paymentAmount(), staffUser.getId());
    return toBulkSettleResponse(result);
  }

  @GetMapping("/debts/pending-total")
  public DebtPendingTotalResponse pendingTotal(
      @PathVariable UUID orgId, @PathVariable UUID branchId) {
    staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    BigDecimal total = customerDebtService.sumPendingOutstanding(orgId, branchId);
    return new DebtPendingTotalResponse(total);
  }

  @GetMapping("/debts")
  public Page<CustomerDebtResponse> list(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @RequestParam(required = false) List<String> status,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate fromDate,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate toDate,
      Pageable pageable) {
    staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    List<CustomerDebtStatus> statuses = parseStatuses(status);
    Instant fromInstant =
        fromDate != null ? fromDate.atStartOfDay().toInstant(java.time.ZoneOffset.UTC) : null;
    Instant toInstant =
        toDate != null
            ? toDate.plusDays(1).atStartOfDay().toInstant(java.time.ZoneOffset.UTC)
            : null;
    return customerDebtService
        .listByBranch(orgId, branchId, statuses, fromInstant, toInstant, normalized)
        .map(CustomerDebtOperatorController::toResponse);
  }

  private static List<CustomerDebtStatus> parseStatuses(List<String> status) {
    if (status == null || status.isEmpty()) {
      return null;
    }
    List<CustomerDebtStatus> result =
        status.stream()
            .map(String::trim)
            .map(String::toUpperCase)
            .filter(s -> !s.isEmpty())
            .distinct()
            .map(
                s -> {
                  if ("CLOSED".equals(s)) {
                    return CustomerDebtStatus.SETTLED;
                  }
                  try {
                    return CustomerDebtStatus.valueOf(s);
                  } catch (IllegalArgumentException e) {
                    return null;
                  }
                })
            .filter(Objects::nonNull)
            .distinct()
            .toList();
    return result.isEmpty() ? null : result;
  }

  private static String statusToApi(CustomerDebtStatus status) {
    if (status == null) {
      return null;
    }
    if (status == CustomerDebtStatus.SETTLED) {
      return "CLOSED";
    }
    return status.name();
  }

  private static CustomerDebtResponse toResponse(CustomerDebt d) {
    BigDecimal outstanding =
        d.getAmount()
            .subtract(d.getAmountSettled() != null ? d.getAmountSettled() : BigDecimal.ZERO);
    return new CustomerDebtResponse(
        d.getId(),
        d.getCustomer().getId(),
        d.getCustomer().getName(),
        d.getCustomer().getPhone(),
        d.getSale() != null ? d.getSale().getId() : null,
        d.getAmount(),
        d.getAmountSettled(),
        outstanding,
        d.getCurrency(),
        d.getDueDate(),
        statusToApi(d.getStatus()),
        d.getNotes(),
        d.getIssuedBy(),
        d.getCreatedBy().getId(),
        d.getCreatedAt());
  }

  private static DebtBulkSettleResponse toBulkSettleResponse(CustomerDebtBulkSettleResult result) {
    List<DebtBulkSettleAllocationLineDto> lines =
        result.allocations().stream()
            .map(CustomerDebtOperatorController::toBulkAllocationLine)
            .toList();
    return new DebtBulkSettleResponse(
        result.paymentAmount(), result.totalApplied(), result.unallocated(), lines);
  }

  private static DebtBulkSettleAllocationLineDto toBulkAllocationLine(
      CustomerDebtBulkSettleAllocation allocation) {
    return new DebtBulkSettleAllocationLineDto(
        allocation.debtId(),
        allocation.appliedAmount(),
        allocation.outstandingBefore(),
        allocation.outstandingAfter(),
        statusToApi(allocation.status()));
  }
}
