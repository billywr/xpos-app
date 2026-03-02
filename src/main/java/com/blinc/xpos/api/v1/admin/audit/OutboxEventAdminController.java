package com.blinc.xpos.api.v1.admin.audit;

import com.blinc.xpos.api.v1.admin.audit.dto.OutboxEventResponse;
import com.blinc.xpos.common.outbox.domain.OutboxEvent;
import com.blinc.xpos.common.outbox.service.OutboxEventService;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/outbox-events")
public class OutboxEventAdminController {

  private final OutboxEventService outboxEventService;
  private final PageRequestFactory pageRequestFactory;

  public OutboxEventAdminController(
      OutboxEventService outboxEventService,
      PageRequestFactory pageRequestFactory) {
    this.outboxEventService = Objects.requireNonNull(outboxEventService);
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory);
  }

  @GetMapping
  public Page<OutboxEventResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    return outboxEventService.list(orgId, normalized)
        .map(OutboxEventAdminController::toResponse);
  }

  @GetMapping("/{eventId}")
  public OutboxEventResponse get(@PathVariable UUID orgId, @PathVariable UUID eventId) {
    return toResponse(outboxEventService.require(orgId, eventId));
  }

  private static OutboxEventResponse toResponse(OutboxEvent e) {
    return new OutboxEventResponse(
        e.getId(),
        e.getOrg().getId(),
        e.getTerminal().getId(),
        e.getEventType(),
        e.getPayload(),
        e.getIdempotencyKey(),
        e.getCreatedAt(),
        e.getSyncedAt(),
        e.getStatus());
  }
}
