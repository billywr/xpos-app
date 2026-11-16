package com.blinc.xpos.modules.organization.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.domain.StaffBranchAssignment;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.repository.StaffBranchAssignmentRepository;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.blinc.xpos.modules.organization.service.StaffBranchAssignmentService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StaffBranchAssignmentServiceImpl implements StaffBranchAssignmentService {

  private final StaffBranchAssignmentRepository assignmentRepository;
  private final OrgService orgService;
  private final StaffUserService staffUserService;
  private final BranchService branchService;
  private final Clock clock;

  public StaffBranchAssignmentServiceImpl(
      StaffBranchAssignmentRepository assignmentRepository,
      OrgService orgService,
      StaffUserService staffUserService,
      BranchService branchService,
      Clock clock) {
    this.assignmentRepository =
        Objects.requireNonNull(assignmentRepository, "assignmentRepository");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.staffUserService = Objects.requireNonNull(staffUserService, "staffUserService");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public StaffBranchAssignment assign(
      UUID orgId, UUID staffUserId, UUID branchId, boolean primary) {
    Org org = orgService.require(orgId);
    StaffUser staffUser = staffUserService.require(orgId, staffUserId);
    Branch branch = branchService.require(orgId, branchId);

    StaffBranchAssignment assignment =
        assignmentRepository
            .findByOrgIdAndStaffUserIdAndBranchId(orgId, staffUserId, branchId)
            .orElseGet(StaffBranchAssignment::new);

    assignment.setOrg(org);
    assignment.setStaffUser(staffUser);
    assignment.setBranch(branch);

    if (assignment.getId() == null) {
      assignment.setCreatedAt(Instant.now(clock));
    }

    if (primary) {
      clearExistingPrimary(orgId, staffUserId);
    }
    assignment.setIsPrimary(primary);

    return assignmentRepository.save(assignment);
  }

  @Override
  @Transactional(readOnly = true)
  public List<StaffBranchAssignment> list(UUID orgId, UUID staffUserId) {
    staffUserService.require(orgId, staffUserId);
    return assignmentRepository.findAllByOrgIdAndStaffUserId(orgId, staffUserId);
  }

  @Override
  @Transactional(readOnly = true)
  public StaffBranchAssignment requirePrimary(UUID orgId, UUID staffUserId) {
    return assignmentRepository
        .findPrimaryByOrgIdAndStaffUserId(orgId, staffUserId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "PRIMARY_BRANCH_NOT_SET", "Primary branch is not set for this staff user"));
  }

  private void clearExistingPrimary(UUID orgId, UUID staffUserId) {
    assignmentRepository
        .findPrimaryByOrgIdAndStaffUserId(orgId, staffUserId)
        .ifPresent(
            existing -> {
              existing.setIsPrimary(false);
              assignmentRepository.save(existing);
            });
  }
}
