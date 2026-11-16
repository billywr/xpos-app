package com.blinc.xpos.modules.fraud.service.impl;

import com.blinc.xpos.common.constants.enums.ApprovalType;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.fraud.domain.ApprovalEvent;
import com.blinc.xpos.modules.fraud.domain.ReasonCode;
import com.blinc.xpos.modules.fraud.repository.ApprovalEventRepository;
import com.blinc.xpos.modules.fraud.service.ApprovalEventService;
import com.blinc.xpos.modules.fraud.service.ReasonCodeService;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ApprovalEventServiceImpl implements ApprovalEventService {

  private final ApprovalEventRepository approvalEventRepository;
  private final OrgService orgService;
  private final BranchService branchService;
  private final StaffUserService staffUserService;
  private final ReasonCodeService reasonCodeService;
  private final Clock clock;

  public ApprovalEventServiceImpl(
      ApprovalEventRepository approvalEventRepository,
      OrgService orgService,
      BranchService branchService,
      StaffUserService staffUserService,
      ReasonCodeService reasonCodeService,
      Clock clock) {
    this.approvalEventRepository = Objects.requireNonNull(approvalEventRepository);
    this.orgService = Objects.requireNonNull(orgService);
    this.branchService = Objects.requireNonNull(branchService);
    this.staffUserService = Objects.requireNonNull(staffUserService);
    this.reasonCodeService = Objects.requireNonNull(reasonCodeService);
    this.clock = Objects.requireNonNull(clock);
  }

  @Override
  @Transactional
  public ApprovalEvent create(
      UUID orgId,
      UUID branchId,
      UUID approvedByStaffUserId,
      UUID requestedByStaffUserId,
      ApprovalType approvalType,
      String targetEntityType,
      UUID targetEntityId,
      UUID reasonCodeId) {
    var branch = branchService.require(orgId, branchId);
    StaffUser approvedBy = staffUserService.require(orgId, approvedByStaffUserId);
    StaffUser requestedBy = staffUserService.require(orgId, requestedByStaffUserId);
    ReasonCode reasonCode =
        reasonCodeId != null ? reasonCodeService.require(orgId, reasonCodeId) : null;
    ApprovalEvent entity = new ApprovalEvent();
    entity.setOrg(branch.getOrg());
    entity.setBranch(branch);
    entity.setApprovedByStaffUser(approvedBy);
    entity.setRequestedByStaffUser(requestedBy);
    entity.setApprovalType(approvalType);
    entity.setTargetEntityType(targetEntityType != null ? targetEntityType : "");
    entity.setTargetEntityId(targetEntityId);
    entity.setReasonCode(reasonCode);
    entity.setApprovedAt(Instant.now(clock));
    return approvalEventRepository.save(entity);
  }

  @Override
  @Transactional(readOnly = true)
  public ApprovalEvent require(UUID orgId, UUID eventId) {
    return approvalEventRepository
        .findByIdAndOrgId(eventId, orgId)
        .orElseThrow(
            () -> new NotFoundException("APPROVAL_EVENT_NOT_FOUND", "Approval event not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<ApprovalEvent> listByBranch(UUID orgId, UUID branchId, Pageable pageable) {
    branchService.require(orgId, branchId);
    return approvalEventRepository.findAllByOrgIdAndBranchId(orgId, branchId, pageable);
  }
}
