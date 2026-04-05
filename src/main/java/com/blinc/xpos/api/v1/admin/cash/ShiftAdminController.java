package com.blinc.xpos.api.v1.admin.cash;

import com.blinc.xpos.api.v1.operator.dto.ShiftResponse;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.cash.domain.Shift;
import com.blinc.xpos.modules.cash.service.ShiftService;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/branches/{branchId}/shifts")
public class ShiftAdminController {

  private final ShiftService shiftService;
  private final PageRequestFactory pageRequestFactory;

  public ShiftAdminController(ShiftService shiftService, PageRequestFactory pageRequestFactory) {
    this.shiftService = Objects.requireNonNull(shiftService, "shiftService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @GetMapping
  public Page<ShiftResponse> list(
      @PathVariable("orgId") UUID orgId,
      @PathVariable("branchId") UUID branchId,
      Pageable pageable) {
    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("openedAt").descending());
    return shiftService
        .listByBranch(orgId, branchId, normalized)
        .map(ShiftAdminController::toResponse);
  }

  private static ShiftResponse toResponse(Shift shift) {
    return new ShiftResponse(
        shift.getId(),
        shift.getOrg().getId(),
        shift.getBranch().getId(),
        shift.getTerminal().getId(),
        shift.getStaffUser().getId(),
        shift.getOpenedAt(),
        shift.getClosedAt(),
        shift.getStatus().name(),
        shift.getOpeningFloatAmount(),
        shift.getClosingCountedAmount(),
        shift.getExpectedCashAmount(),
        shift.getVarianceAmount(),
        shift.getClosedByManager() != null ? shift.getClosedByManager().getId() : null,
        shift.getVarianceReasonCode() != null ? shift.getVarianceReasonCode().getId() : null);
  }
}
