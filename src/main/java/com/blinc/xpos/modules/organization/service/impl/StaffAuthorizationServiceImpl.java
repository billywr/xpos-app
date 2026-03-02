package com.blinc.xpos.modules.organization.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.StaffBranchAssignment;
import com.blinc.xpos.modules.organization.domain.StaffProfile;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.repository.StaffBranchAssignmentRepository;
import com.blinc.xpos.modules.organization.repository.StaffProfileRepository;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import com.blinc.xpos.modules.organization.service.StaffBranchAssignmentService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StaffAuthorizationServiceImpl implements StaffAuthorizationService {

  private final StaffUserService staffUserService;
  private final StaffBranchAssignmentService assignmentService;
  private final StaffBranchAssignmentRepository assignmentRepository;
  private final StaffProfileRepository staffProfileRepository;
  private final BranchService branchService;

  public StaffAuthorizationServiceImpl(
      StaffUserService staffUserService,
      StaffBranchAssignmentService assignmentService,
      StaffBranchAssignmentRepository assignmentRepository,
      StaffProfileRepository staffProfileRepository,
      BranchService branchService) {
    this.staffUserService = Objects.requireNonNull(staffUserService, "staffUserService");
    this.assignmentService = Objects.requireNonNull(assignmentService, "assignmentService");
    this.assignmentRepository =
        Objects.requireNonNull(assignmentRepository, "assignmentRepository");
    this.staffProfileRepository =
        Objects.requireNonNull(staffProfileRepository, "staffProfileRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
  }

  @Override
  @Transactional(readOnly = true)
  public StaffUser requireStaffUser(UUID orgId, String iamUserId) {
    return staffUserService.requireByIamUserId(orgId, iamUserId);
  }

  @Override
  @Transactional(readOnly = true)
  public StaffUser requireStaffUserForBranch(UUID orgId, UUID branchId, String iamUserId) {
    try {
      StaffUser staffUser = staffUserService.requireByIamUserId(orgId, iamUserId);
      return staffUser;
    } catch (NotFoundException e) {
      return assignmentRepository
          .findByBranchIdAndStaffUserIamUserId(branchId, iamUserId)
          .filter(a -> a.getOrg().getId().equals(orgId))
          .map(StaffBranchAssignment::getStaffUser)
          .orElseThrow(
              () ->
                  new NotFoundException(
                      "STAFF_USER_NOT_FOUND",
                      "Staff user not found for this organization and branch. "
                          + "Register as staff in Admin for this org and ensure you are assigned to this branch."));
    }
  }

  @Override
  @Transactional(readOnly = true)
  public Branch findPrimaryBranch(UUID orgId, UUID staffUserId) {
    try {
      StaffBranchAssignment assignment = assignmentService.requirePrimary(orgId, staffUserId);
      return branchService.require(orgId, assignment.getBranch().getId());
    } catch (RuntimeException ex) {
      return null;
    }
  }

  @Override
  @Transactional(readOnly = true)
  public StaffProfile findProfile(UUID orgId, UUID staffUserId) {
    return staffProfileRepository.findByOrgIdAndStaffUserId(orgId, staffUserId).orElse(null);
  }
}
