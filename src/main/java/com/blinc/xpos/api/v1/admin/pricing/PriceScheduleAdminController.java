package com.blinc.xpos.api.v1.admin.pricing;

import com.blinc.xpos.api.v1.admin.pricing.dto.PriceScheduleCreateRequest;
import com.blinc.xpos.api.v1.admin.pricing.dto.PriceScheduleResponse;
import com.blinc.xpos.api.v1.admin.pricing.dto.PriceScheduleUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.pricing.domain.PriceSchedule;
import com.blinc.xpos.modules.pricing.service.PriceScheduleService;
import jakarta.validation.Valid;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/price-schedules")
public class PriceScheduleAdminController {

  private final PriceScheduleService priceScheduleService;
  private final PageRequestFactory pageRequestFactory;

  public PriceScheduleAdminController(
      PriceScheduleService priceScheduleService, PageRequestFactory pageRequestFactory) {
    this.priceScheduleService =
        Objects.requireNonNull(priceScheduleService, "priceScheduleService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public PriceScheduleResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody PriceScheduleCreateRequest request) {
    PriceSchedule schedule =
        priceScheduleService.create(
            orgId,
            request.branchId(),
            request.name(),
            request.startsAt(),
            request.endsAt(),
            request.daysOfWeek());
    return toResponse(schedule);
  }

  @GetMapping
  public Page<PriceScheduleResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    return priceScheduleService.list(orgId, normalized).map(this::toResponse);
  }

  @GetMapping("/{priceScheduleId}")
  public PriceScheduleResponse get(
      @PathVariable UUID orgId, @PathVariable UUID priceScheduleId) {
    return toResponse(priceScheduleService.require(orgId, priceScheduleId));
  }

  @PatchMapping("/{priceScheduleId}")
  public PriceScheduleResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID priceScheduleId,
      @Valid @RequestBody PriceScheduleUpdateRequest request) {
    PriceSchedule updated =
        priceScheduleService.update(
            orgId,
            priceScheduleId,
            request.branchId(),
            request.name(),
            request.startsAt(),
            request.endsAt(),
            request.daysOfWeek());
    return toResponse(updated);
  }

  private PriceScheduleResponse toResponse(PriceSchedule schedule) {
    return new PriceScheduleResponse(
        schedule.getId(),
        schedule.getOrg().getId(),
        schedule.getBranch().getId(),
        schedule.getName(),
        schedule.getStartsAt().toString(),
        schedule.getEndsAt().toString(),
        schedule.getDaysOfWeek(),
        schedule.getCreatedAt(),
        schedule.getUpdatedAt());
  }
}
