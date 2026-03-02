package com.blinc.xpos.api.v1.admin.pricing;

import com.blinc.xpos.api.v1.admin.pricing.dto.ScheduledPriceCreateRequest;
import com.blinc.xpos.api.v1.admin.pricing.dto.ScheduledPriceResponse;
import com.blinc.xpos.modules.pricing.domain.ScheduledPrice;
import com.blinc.xpos.modules.pricing.service.ScheduledPriceService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/price-schedules/{priceScheduleId}/prices")
public class ScheduledPriceAdminController {

  private final ScheduledPriceService scheduledPriceService;

  public ScheduledPriceAdminController(ScheduledPriceService scheduledPriceService) {
    this.scheduledPriceService =
        Objects.requireNonNull(scheduledPriceService, "scheduledPriceService");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ScheduledPriceResponse add(
      @PathVariable UUID orgId,
      @PathVariable UUID priceScheduleId,
      @Valid @RequestBody ScheduledPriceCreateRequest request) {
    ScheduledPrice scheduled =
        scheduledPriceService.add(
            orgId,
            priceScheduleId,
            request.itemId(),
            request.price(),
            request.currency());
    return toResponse(scheduled);
  }

  @GetMapping
  public List<ScheduledPriceResponse> list(
      @PathVariable UUID orgId, @PathVariable UUID priceScheduleId) {
    return scheduledPriceService.listBySchedule(orgId, priceScheduleId).stream()
        .map(this::toResponse)
        .toList();
  }

  @GetMapping("/{scheduledPriceId}")
  public ScheduledPriceResponse get(
      @PathVariable UUID orgId,
      @PathVariable UUID priceScheduleId,
      @PathVariable UUID scheduledPriceId) {
    return toResponse(
        scheduledPriceService.requireInSchedule(
            orgId, priceScheduleId, scheduledPriceId));
  }

  @DeleteMapping("/{scheduledPriceId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void remove(
      @PathVariable UUID orgId,
      @PathVariable UUID priceScheduleId,
      @PathVariable UUID scheduledPriceId) {
    scheduledPriceService.remove(orgId, priceScheduleId, scheduledPriceId);
  }

  private ScheduledPriceResponse toResponse(ScheduledPrice scheduled) {
    return new ScheduledPriceResponse(
        scheduled.getId(),
        scheduled.getPriceSchedule().getId(),
        scheduled.getItem().getId(),
        scheduled.getPrice(),
        scheduled.getCurrency(),
        scheduled.getCreatedAt());
  }
}
