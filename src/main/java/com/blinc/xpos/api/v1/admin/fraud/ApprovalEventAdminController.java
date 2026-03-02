package com.blinc.xpos.api.v1.admin.fraud;

import com.blinc.xpos.api.v1.admin.fraud.dto.ApprovalEventResponse;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.fraud.domain.ApprovalEvent;
import com.blinc.xpos.modules.fraud.service.ApprovalEventService;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/branches/{branchId}/approval-events")
public class ApprovalEventAdminController {

  private final ApprovalEventService approvalEventService;
  private final PageRequestFactory pageRequestFactory;

  public ApprovalEventAdminController(
      ApprovalEventService approvalEventService,
      PageRequestFactory pageRequestFactory) {
    this.approvalEventService = Objects.requireNonNull(approvalEventService);
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory);
  }

  @GetMapping
  public Page<ApprovalEventResponse> list(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("approvedAt").descending());
    return approvalEventService.listByBranch(orgId, branchId, normalized)
        .map(ApprovalEventAdminController::toResponse);
  }

  @GetMapping("/{eventId}")
  public ApprovalEventResponse get(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID eventId) {
    return toResponse(approvalEventService.require(orgId, eventId));
  }

  private static ApprovalEventResponse toResponse(ApprovalEvent e) {
    return new ApprovalEventResponse(
        e.getId(),
        e.getOrg().getId(),
        e.getBranch().getId(),
        e.getApprovedByStaffUser().getId(),
        e.getRequestedByStaffUser().getId(),
        e.getApprovalType(),
        e.getTargetEntityType(),
        e.getTargetEntityId(),
        e.getReasonCode() != null ? e.getReasonCode().getId() : null,
        e.getApprovedAt());
  }
}
