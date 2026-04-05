package com.blinc.xpos.modules.fraud.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.fraud.domain.ApprovalPolicy;
import com.blinc.xpos.modules.fraud.repository.ApprovalPolicyRepository;
import com.blinc.xpos.modules.fraud.service.ApprovalPolicyService;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.OrgService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ApprovalPolicyServiceImpl implements ApprovalPolicyService {

  private final ApprovalPolicyRepository approvalPolicyRepository;
  private final OrgService orgService;
  private final BranchService branchService;
  private final Clock clock;

  public ApprovalPolicyServiceImpl(
      ApprovalPolicyRepository approvalPolicyRepository,
      OrgService orgService,
      BranchService branchService,
      Clock clock) {
    this.approvalPolicyRepository = Objects.requireNonNull(approvalPolicyRepository);
    this.orgService = Objects.requireNonNull(orgService);
    this.branchService = Objects.requireNonNull(branchService);
    this.clock = Objects.requireNonNull(clock);
  }

  @Override
  @Transactional
  public ApprovalPolicy create(
      UUID orgId,
      UUID branchId,
      String policyCode,
      BigDecimal thresholdValue,
      Boolean requiresManager) {
    var org = orgService.require(orgId);
    ApprovalPolicy entity = new ApprovalPolicy();
    entity.setOrg(org);
    entity.setBranch(branchId != null ? branchService.require(orgId, branchId) : null);
    entity.setPolicyCode(policyCode != null ? policyCode.trim() : "");
    entity.setThresholdValue(thresholdValue);
    entity.setRequiresManager(Boolean.TRUE.equals(requiresManager));
    Instant now = Instant.now(clock);
    entity.setCreatedAt(now);
    entity.setUpdatedAt(now);
    return approvalPolicyRepository.save(entity);
  }

  @Override
  @Transactional(readOnly = true)
  public ApprovalPolicy require(UUID orgId, UUID policyId) {
    return approvalPolicyRepository
        .findByIdAndOrgId(policyId, orgId)
        .orElseThrow(
            () -> new NotFoundException("APPROVAL_POLICY_NOT_FOUND", "Approval policy not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<ApprovalPolicy> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return approvalPolicyRepository.findAllByOrgId(orgId, pageable);
  }
}
