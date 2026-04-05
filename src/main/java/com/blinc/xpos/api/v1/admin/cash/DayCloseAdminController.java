package com.blinc.xpos.api.v1.admin.cash;

import com.blinc.xpos.api.v1.operator.dto.DayCloseResponse;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.cash.domain.DayClose;
import com.blinc.xpos.modules.cash.service.DayCloseService;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/branches/{branchId}/day-closes")
public class DayCloseAdminController {

  private final DayCloseService dayCloseService;
  private final PageRequestFactory pageRequestFactory;

  public DayCloseAdminController(
      DayCloseService dayCloseService, PageRequestFactory pageRequestFactory) {
    this.dayCloseService = Objects.requireNonNull(dayCloseService, "dayCloseService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @GetMapping
  public Page<DayCloseResponse> list(
      @PathVariable("orgId") UUID orgId,
      @PathVariable("branchId") UUID branchId,
      Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("businessDate").descending());
    return dayCloseService
        .listByBranch(orgId, branchId, normalized)
        .map(DayCloseAdminController::toResponse);
  }

  @GetMapping("/{dayCloseId}")
  public DayCloseResponse get(
      @PathVariable("orgId") UUID orgId,
      @PathVariable("branchId") UUID branchId,
      @PathVariable("dayCloseId") UUID dayCloseId) {
    DayClose dayClose = dayCloseService.require(orgId, dayCloseId);
    return toResponse(dayClose);
  }

  private static DayCloseResponse toResponse(DayClose d) {
    return new DayCloseResponse(
        d.getId(),
        d.getOrg().getId(),
        d.getBranch().getId(),
        d.getBusinessDate(),
        d.getStatus().name(),
        d.getClosedBy() != null ? d.getClosedBy().getId() : null,
        d.getClosedAt(),
        d.getCreatedAt());
  }
}
