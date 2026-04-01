package com.blinc.xpos.modules.organization.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.StaffBranchAssignment;
import com.blinc.xpos.modules.organization.domain.StaffProfile;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.repository.BranchRepository;
import com.blinc.xpos.modules.organization.repository.StaffBranchAssignmentRepository;
import com.blinc.xpos.modules.organization.repository.StaffProfileRepository;
import com.blinc.xpos.modules.organization.repository.StaffUserRepository;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StaffAuthorizationServiceImpl implements StaffAuthorizationService {

  private final StaffUserService staffUserService;
  private final StaffUserRepository staffUserRepository;
  private final StaffBranchAssignmentRepository assignmentRepository;
  private final StaffProfileRepository staffProfileRepository;
  private final BranchRepository branchRepository;

  public StaffAuthorizationServiceImpl(
      StaffUserService staffUserService,
      StaffUserRepository staffUserRepository,
      StaffBranchAssignmentRepository assignmentRepository,
      StaffProfileRepository staffProfileRepository,
      BranchRepository branchRepository) {
    this.staffUserService = Objects.requireNonNull(staffUserService, "staffUserService");
    this.staffUserRepository = Objects.requireNonNull(staffUserRepository, "staffUserRepository");
    this.assignmentRepository =
        Objects.requireNonNull(assignmentRepository, "assignmentRepository");
    this.staffProfileRepository =
        Objects.requireNonNull(staffProfileRepository, "staffProfileRepository");
    this.branchRepository = Objects.requireNonNull(branchRepository, "branchRepository");
  }

  @Override
  @Transactional(readOnly = true)
  public StaffUser requireStaffUser(UUID orgId, String iamUserId) {
    return staffUserService.requireByIamUserId(orgId, iamUserId);
  }

  @Override
  @Transactional(readOnly = true)
  public StaffUser requireStaffUserForBranch(UUID orgId, UUID branchId, String iamUserId) {
    return staffUserRepository
        .findByOrgIdAndIamUserId(orgId, iamUserId)
        .orElseGet(
            () ->
                assignmentRepository
                    .findByBranchIdAndStaffUserIamUserId(branchId, iamUserId)
                    .filter(a -> a.getOrg().getId().equals(orgId))
                    .map(StaffBranchAssignment::getStaffUser)
                    .orElseThrow(
                        () ->
                            new NotFoundException(
                                "STAFF_USER_NOT_FOUND",
                                "Staff user not found for this organization and branch. "
                                    + "Register as staff in Admin for this org and ensure you are "
                                    + "assigned to this branch.")));
  }

  @Override
  @Transactional(readOnly = true)
  public Branch findPrimaryBranch(UUID orgId, UUID staffUserId) {
    return assignmentRepository
        .findPrimaryByOrgIdAndStaffUserId(orgId, staffUserId)
        .flatMap(
            assign ->
                branchRepository.findByIdAndOrgId(assign.getBranch().getId(), orgId))
        .orElse(null);
  }

  @Override
  @Transactional(readOnly = true)
  public StaffProfile findProfile(UUID orgId, UUID staffUserId) {
    return staffProfileRepository.findByOrgIdAndStaffUserId(orgId, staffUserId).orElse(null);
  }
}
