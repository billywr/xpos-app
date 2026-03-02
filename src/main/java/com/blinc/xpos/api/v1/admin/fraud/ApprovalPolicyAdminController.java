package com.blinc.xpos.api.v1.admin.fraud;

import com.blinc.xpos.api.v1.admin.fraud.dto.ApprovalPolicyCreateRequest;
import com.blinc.xpos.api.v1.admin.fraud.dto.ApprovalPolicyResponse;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.fraud.domain.ApprovalPolicy;
import com.blinc.xpos.modules.fraud.service.ApprovalPolicyService;
import jakarta.validation.Valid;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/approval-policies")
public class ApprovalPolicyAdminController {

  private final ApprovalPolicyService approvalPolicyService;
  private final PageRequestFactory pageRequestFactory;

  public ApprovalPolicyAdminController(
      ApprovalPolicyService approvalPolicyService,
      PageRequestFactory pageRequestFactory) {
    this.approvalPolicyService = Objects.requireNonNull(approvalPolicyService);
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApprovalPolicyResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody ApprovalPolicyCreateRequest request) {
    ApprovalPolicy created =
        approvalPolicyService.create(
            orgId,
            request.branchId(),
            request.policyCode(),
            request.thresholdValue(),
            request.requiresManager());
    return toResponse(created);
  }

  @GetMapping
  public Page<ApprovalPolicyResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("policyCode").ascending());
    return approvalPolicyService.list(orgId, normalized)
        .map(ApprovalPolicyAdminController::toResponse);
  }

  @GetMapping("/{policyId}")
  public ApprovalPolicyResponse get(@PathVariable UUID orgId, @PathVariable UUID policyId) {
    return toResponse(approvalPolicyService.require(orgId, policyId));
  }

  private static ApprovalPolicyResponse toResponse(ApprovalPolicy p) {
    return new ApprovalPolicyResponse(
        p.getId(),
        p.getOrg().getId(),
        p.getBranch() != null ? p.getBranch().getId() : null,
        p.getPolicyCode(),
        p.getThresholdValue(),
        p.getRequiresManager(),
        p.getCreatedAt(),
        p.getUpdatedAt());
  }
}
