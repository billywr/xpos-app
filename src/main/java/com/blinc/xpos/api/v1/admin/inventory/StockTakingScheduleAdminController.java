package com.blinc.xpos.api.v1.admin.inventory;

import com.blinc.xpos.api.v1.admin.inventory.dto.StockCountLineResponse;
import com.blinc.xpos.api.v1.admin.inventory.dto.StockCountSessionResponse;
import com.blinc.xpos.api.v1.admin.inventory.dto.StockTakingScheduleCreateRequest;
import com.blinc.xpos.api.v1.admin.inventory.dto.StockTakingScheduleResponse;
import com.blinc.xpos.api.v1.admin.inventory.dto.StockTakingScheduleUpdateRequest;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.inventory.domain.StockCountLine;
import com.blinc.xpos.modules.inventory.domain.StockCountSession;
import com.blinc.xpos.modules.inventory.domain.StockTakingSchedule;
import com.blinc.xpos.modules.inventory.repository.StockCountLineRepository;
import com.blinc.xpos.modules.inventory.service.StockTakingScheduleService;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/stock-taking-schedules")
public class StockTakingScheduleAdminController {

  private final StockTakingScheduleService scheduleService;
  private final StockCountLineRepository lineRepository;
  private final PageRequestFactory pageRequestFactory;
  private final CurrentPrincipalResolver principalResolver;
  private final StaffAuthorizationService staffAuthorizationService;

  public StockTakingScheduleAdminController(
      StockTakingScheduleService scheduleService,
      StockCountLineRepository lineRepository,
      PageRequestFactory pageRequestFactory,
      CurrentPrincipalResolver principalResolver,
      StaffAuthorizationService staffAuthorizationService) {
    this.scheduleService = Objects.requireNonNull(scheduleService, "scheduleService");
    this.lineRepository = Objects.requireNonNull(lineRepository, "lineRepository");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public StockTakingScheduleResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody StockTakingScheduleCreateRequest request) {
    StockTakingSchedule schedule =
        scheduleService.create(
            orgId,
            request.branchId(),
            request.frequency(),
            request.dayOfWeek(),
            request.scheduledHour(),
            request.scheduledMinute());
    return toResponse(schedule);
  }

  @GetMapping
  public Page<StockTakingScheduleResponse> list(
      @PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    return scheduleService.listByOrg(orgId, normalized).map(this::toResponse);
  }

  @GetMapping("/by-branch")
  public StockTakingScheduleResponse getByBranch(
      @PathVariable UUID orgId, @RequestParam UUID branchId) {
    return toResponse(scheduleService.getByBranch(orgId, branchId));
  }

  @GetMapping("/{scheduleId}")
  public StockTakingScheduleResponse get(
      @PathVariable UUID orgId, @PathVariable UUID scheduleId) {
    return toResponse(scheduleService.require(orgId, scheduleId));
  }

  @PutMapping("/{scheduleId}")
  public StockTakingScheduleResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID scheduleId,
      @Valid @RequestBody StockTakingScheduleUpdateRequest request) {
    StockTakingSchedule schedule =
        scheduleService.update(
            orgId,
            scheduleId,
            request.frequency(),
            request.dayOfWeek(),
            request.scheduledHour(),
            request.scheduledMinute(),
            request.isActive());
    return toResponse(schedule);
  }

  @DeleteMapping("/{scheduleId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(
      @PathVariable UUID orgId, @PathVariable UUID scheduleId) {
    scheduleService.delete(orgId, scheduleId);
  }

  @PostMapping("/{scheduleId}/trigger")
  @ResponseStatus(HttpStatus.CREATED)
  public StockCountSessionResponse trigger(
      @PathVariable UUID orgId, @PathVariable UUID scheduleId) {
    var staffUser =
        staffAuthorizationService.requireStaffUser(orgId, principalResolver.require().iamUserId());
    StockCountSession session = scheduleService.trigger(orgId, scheduleId, staffUser.getId());
    return toSessionResponse(session);
  }

  private StockTakingScheduleResponse toResponse(StockTakingSchedule s) {
    return new StockTakingScheduleResponse(
        s.getId(),
        s.getOrg().getId(),
        s.getBranch().getId(),
        s.getFrequency(),
        s.getDayOfWeek(),
        s.getScheduledHour(),
        s.getScheduledMinute(),
        Boolean.TRUE.equals(s.getIsActive()),
        s.getLastRunAt(),
        s.getCreatedAt(),
        s.getUpdatedAt());
  }

  private StockCountSessionResponse toSessionResponse(StockCountSession s) {
    List<StockCountLine> lines = lineRepository.findBySessionIdOrderByCreatedAt(s.getId());
    List<StockCountLineResponse> lineResponses =
        lines.stream().map(this::toLineResponse).toList();
    return new StockCountSessionResponse(
        s.getId(),
        s.getOrg().getId(),
        s.getBranch().getId(),
        s.getStatus(),
        s.getSourceType(),
        s.getScheduleId(),
        s.getStartedBy().getId(),
        s.getStartedAt(),
        s.getClosedBy() != null ? s.getClosedBy().getId() : null,
        s.getClosedAt(),
        lineResponses);
  }

  private StockCountLineResponse toLineResponse(StockCountLine l) {
    return new StockCountLineResponse(
        l.getId(),
        l.getSession().getId(),
        l.getItem().getId(),
        l.getItem().getName(),
        l.getCountedQty(),
        l.getSystemQty(),
        l.getVarianceQty(),
        l.getCreatedAt());
  }
}
