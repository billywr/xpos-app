package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.api.v1.operator.dto.RecurringUtilityCreateRequest;
import com.blinc.xpos.api.v1.operator.dto.RecurringUtilityListResponse;
import com.blinc.xpos.api.v1.operator.dto.RecurringUtilityResponse;
import com.blinc.xpos.api.v1.operator.dto.RecurringUtilitySummaryResponse;
import com.blinc.xpos.api.v1.operator.dto.RecurringUtilityUpdateRequest;
import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.cash.domain.RecurringUtilityExpense;
import com.blinc.xpos.modules.cash.service.RecurringUtilityExpenseService;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
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
@RequestMapping("/api/v1/operator/orgs/{orgId}/branches/{branchId}/recurring-utilities")
public class RecurringUtilityOperatorController {

  private final RecurringUtilityExpenseService recurringUtilityService;
  private final PageRequestFactory pageRequestFactory;
  private final CurrentPrincipalResolver principalResolver;
  private final StaffAuthorizationService staffAuthorizationService;

  public RecurringUtilityOperatorController(
      RecurringUtilityExpenseService recurringUtilityService,
      PageRequestFactory pageRequestFactory,
      CurrentPrincipalResolver principalResolver,
      StaffAuthorizationService staffAuthorizationService) {
    this.recurringUtilityService =
        Objects.requireNonNull(recurringUtilityService, "recurringUtilityService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public RecurringUtilityResponse create(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @Valid @RequestBody RecurringUtilityCreateRequest request) {
    var staffUser =
        staffAuthorizationService.requireStaffUserForBranch(
            orgId, branchId, principalResolver.require().iamUserId());
    RecurringUtilityExpense entity =
        recurringUtilityService.create(
            orgId,
            branchId,
            request.name(),
            request.amount(),
            request.effectiveFrom(),
            request.effectiveTo(),
            request.applyTiming(),
            request.dueDayOfMonth(),
            request.payee(),
            request.accountNumber(),
            request.incurredBy(),
            request.notes(),
            staffUser.getId());
    return toResponse(entity);
  }

  @GetMapping
  public RecurringUtilityListResponse list(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @RequestParam(required = false) Boolean active,
      @RequestParam(required = false) String query,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate startDate,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate endDate,
      Pageable pageable) {
    staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());

    if (startDate != null && endDate != null) {
      if (endDate.isBefore(startDate)) {
        throw new BadRequestException("INVALID_DATE_RANGE", "endDate must not be before startDate");
      }
      List<RecurringUtilityResponse> items =
          recurringUtilityService
              .listApplicableForPeriod(orgId, branchId, startDate, endDate)
              .stream()
              .filter(
                  u -> {
                    if (query == null || query.isBlank()) {
                      return true;
                    }
                    String q = query.trim().toLowerCase();
                    return (u.getName() != null && u.getName().toLowerCase().contains(q))
                        || (u.getPayee() != null && u.getPayee().toLowerCase().contains(q))
                        || (u.getAccountNumber() != null
                            && u.getAccountNumber().toLowerCase().contains(q));
                  })
              .map(RecurringUtilityOperatorController::toResponse)
              .toList();
      return new RecurringUtilityListResponse(items, 0, Math.max(items.size(), 1), items.size(), 1);
    }

    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    Page<RecurringUtilityResponse> page =
        recurringUtilityService
            .list(orgId, branchId, active, query, normalized)
            .map(RecurringUtilityOperatorController::toResponse);
    return new RecurringUtilityListResponse(
        page.getContent(),
        page.getNumber(),
        page.getSize(),
        page.getTotalElements(),
        page.getTotalPages());
  }

  @GetMapping("/summary")
  public RecurringUtilitySummaryResponse summary(
      @PathVariable UUID orgId, @PathVariable UUID branchId) {
    staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    long count = recurringUtilityService.countActive(orgId, branchId);
    BigDecimal total = recurringUtilityService.sumActiveMonthlyAmount(orgId, branchId);
    return new RecurringUtilitySummaryResponse(count, total != null ? total : BigDecimal.ZERO);
  }

  @GetMapping("/{utilityId}")
  public RecurringUtilityResponse get(
      @PathVariable UUID orgId, @PathVariable UUID branchId, @PathVariable UUID utilityId) {
    staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    RecurringUtilityExpense entity = recurringUtilityService.require(orgId, branchId, utilityId);
    return toResponse(entity);
  }

  @PatchMapping("/{utilityId}")
  public RecurringUtilityResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID utilityId,
      @Valid @RequestBody RecurringUtilityUpdateRequest request) {
    var staffUser =
        staffAuthorizationService.requireStaffUserForBranch(
            orgId, branchId, principalResolver.require().iamUserId());
    RecurringUtilityExpense entity =
        recurringUtilityService.update(
            orgId,
            branchId,
            utilityId,
            request.name(),
            request.amount(),
            request.effectiveFrom(),
            request.effectiveTo(),
            request.isRateChange(),
            request.applyTiming(),
            request.dueDayOfMonth(),
            request.payee(),
            request.accountNumber(),
            request.incurredBy(),
            request.active(),
            request.notes(),
            staffUser.getId());
    return toResponse(entity);
  }

  @DeleteMapping("/{utilityId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(
      @PathVariable UUID orgId, @PathVariable UUID branchId, @PathVariable UUID utilityId) {
    var staffUser =
        staffAuthorizationService.requireStaffUserForBranch(
            orgId, branchId, principalResolver.require().iamUserId());
    recurringUtilityService.softDelete(orgId, branchId, utilityId, staffUser.getId());
  }

  public static RecurringUtilityResponse toResponse(RecurringUtilityExpense u) {
    String staffName = null;
    if (u.getCreatedBy() != null) {
      staffName = u.getCreatedBy().getUsername();
    }
    java.time.LocalDate effectiveFrom = u.getEffectiveFrom();
    if (effectiveFrom == null) {
      effectiveFrom =
          u.getCreatedAt() != null
              ? u.getCreatedAt()
                  .atZone(java.time.ZoneId.systemDefault())
                  .toLocalDate()
                  .withDayOfMonth(1)
              : java.time.LocalDate.now().withDayOfMonth(1);
    }
    return new RecurringUtilityResponse(
        u.getId(),
        u.getOrg().getId(),
        u.getBranch().getId(),
        u.getName(),
        u.getAmount(),
        effectiveFrom,
        u.getEffectiveTo(),
        u.getApplyTiming(),
        u.getDueDayOfMonth() != null ? u.getDueDayOfMonth() : 1,
        u.getPayee(),
        u.getAccountNumber(),
        u.getIncurredBy(),
        u.getNotes(),
        u.isActive(),
        u.getCreatedBy() != null ? u.getCreatedBy().getId() : null,
        staffName,
        u.getCreatedAt(),
        u.getUpdatedAt());
  }
}
