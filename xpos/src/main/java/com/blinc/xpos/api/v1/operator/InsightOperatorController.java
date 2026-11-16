package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.assistant.dto.InsightEventResponse;
import com.blinc.xpos.modules.assistant.service.InsightEventService;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/operator/orgs/{orgId}/branches/{branchId}/assistant/insights")
public class InsightOperatorController {

  private final InsightEventService insightEventService;
  private final StaffAuthorizationService staffAuthorizationService;
  private final BranchService branchService;
  private final CurrentPrincipalResolver principalResolver;
  private final PageRequestFactory pageRequestFactory;

  public InsightOperatorController(
      InsightEventService insightEventService,
      StaffAuthorizationService staffAuthorizationService,
      BranchService branchService,
      CurrentPrincipalResolver principalResolver,
      PageRequestFactory pageRequestFactory) {
    this.insightEventService = Objects.requireNonNull(insightEventService, "insightEventService");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @GetMapping
  public Page<InsightEventResponse> list(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size) {
    staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    branchService.require(orgId, branchId);
    Pageable pageable =
        pageRequestFactory.normalize(
            PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")),
            Sort.by(Sort.Direction.DESC, "createdAt"));
    return insightEventService.listUnacknowledged(orgId, branchId, pageable);
  }

  @GetMapping("/count")
  public Map<String, Long> count(@PathVariable UUID orgId, @PathVariable UUID branchId) {
    staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    branchService.require(orgId, branchId);
    return Map.of("unacknowledged", insightEventService.countUnacknowledged(orgId, branchId));
  }

  @PostMapping("/{insightId}/acknowledge")
  public InsightEventResponse acknowledge(
      @PathVariable UUID orgId, @PathVariable UUID branchId, @PathVariable UUID insightId) {
    staffAuthorizationService.requireStaffUserForBranch(
        orgId, branchId, principalResolver.require().iamUserId());
    branchService.require(orgId, branchId);
    return insightEventService.acknowledge(orgId, insightId);
  }
}
