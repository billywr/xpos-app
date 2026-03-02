package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.api.v1.operator.dto.MiscExpenseCreateRequest;
import com.blinc.xpos.api.v1.operator.dto.MiscExpenseListResponse;
import com.blinc.xpos.api.v1.operator.dto.MiscExpenseResponse;
import com.blinc.xpos.api.v1.operator.dto.MiscExpenseUpdateRequest;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.cash.domain.MiscExpense;
import com.blinc.xpos.modules.cash.service.MiscExpenseService;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import jakarta.validation.Valid;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/operator/orgs/{orgId}/branches/{branchId}")
public class MiscExpenseOperatorController {

  private final MiscExpenseService miscExpenseService;
  private final PageRequestFactory pageRequestFactory;
  private final CurrentPrincipalResolver principalResolver;
  private final StaffAuthorizationService staffAuthorizationService;

  public MiscExpenseOperatorController(
      MiscExpenseService miscExpenseService,
      PageRequestFactory pageRequestFactory,
      CurrentPrincipalResolver principalResolver,
      StaffAuthorizationService staffAuthorizationService) {
    this.miscExpenseService =
        Objects.requireNonNull(miscExpenseService, "miscExpenseService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
  }

  @PostMapping("/misc-expenses")
  @ResponseStatus(HttpStatus.CREATED)
  public MiscExpenseResponse create(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @Valid @RequestBody MiscExpenseCreateRequest request) {
    var staffUser = staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    MiscExpense expense =
        miscExpenseService.create(
            orgId,
            branchId,
            request.amount(),
            request.category(),
            request.description(),
            request.incurredBy(),
            request.receiptRef(),
            request.terminalId(),
            request.shiftId(),
            staffUser.getId());
    return toResponse(expense);
  }

  @PatchMapping("/misc-expenses/{expenseId}")
  public MiscExpenseResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID expenseId,
      @Valid @RequestBody MiscExpenseUpdateRequest request) {
    var staffUser = staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    MiscExpense expense =
        miscExpenseService.update(
            orgId,
            expenseId,
            request.amount(),
            request.category(),
            request.description(),
            request.incurredBy(),
            request.receiptRef(),
            staffUser.getId());
    return toResponse(expense);
  }

  @PostMapping("/misc-expenses/{expenseId}/cancel")
  public MiscExpenseResponse cancel(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID expenseId) {
    var staffUser = staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    MiscExpense expense =
        miscExpenseService.softDelete(orgId, expenseId, staffUser.getId());
    return toResponse(expense);
  }

  @GetMapping("/misc-expenses")
  public MiscExpenseListResponse list(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      Pageable pageable) {
    staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    var page = miscExpenseService.listByBranch(orgId, branchId, normalized)
        .map(MiscExpenseOperatorController::toResponse);
    var totalAmount = miscExpenseService.sumAmountByBranch(orgId, branchId);
    return MiscExpenseListResponse.from(page, totalAmount);
  }

  private static MiscExpenseResponse toResponse(MiscExpense e) {
    return new MiscExpenseResponse(
        e.getId(),
        e.getAmount(),
        e.getCategory() != null ? e.getCategory().name() : null,
        e.getDescription(),
        e.getIncurredBy(),
        e.getReceiptRef(),
        e.getTerminal() != null ? e.getTerminal().getId() : null,
        e.getShift() != null ? e.getShift().getId() : null,
        e.getCreatedBy().getId(),
        e.getCreatedAt());
  }
}
