package com.blinc.xpos.modules.organization.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
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
import java.util.Optional;
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
  private final CurrentPrincipalResolver principalResolver;

  public StaffAuthorizationServiceImpl(
      StaffUserService staffUserService,
      StaffUserRepository staffUserRepository,
      StaffBranchAssignmentRepository assignmentRepository,
      StaffProfileRepository staffProfileRepository,
      BranchRepository branchRepository,
      CurrentPrincipalResolver principalResolver) {
    this.staffUserService = Objects.requireNonNull(staffUserService, "staffUserService");
    this.staffUserRepository = Objects.requireNonNull(staffUserRepository, "staffUserRepository");
    this.assignmentRepository =
        Objects.requireNonNull(assignmentRepository, "assignmentRepository");
    this.staffProfileRepository =
        Objects.requireNonNull(staffProfileRepository, "staffProfileRepository");
    this.branchRepository = Objects.requireNonNull(branchRepository, "branchRepository");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
  }

  @Override
  @Transactional(readOnly = true)
  public StaffUser requireStaffUser(UUID orgId, String iamUserId) {
    Optional<StaffUser> byIam = staffUserRepository.findByOrgIdAndIamUserId(orgId, iamUserId);
    if (byIam.isPresent()) {
      return byIam.get();
    }
    String username = principalResolver.require().username();
    if (username != null) {
      Optional<StaffUser> byName = staffUserRepository.findByOrgIdAndUsername(orgId, username);
      if (byName.isPresent()) {
        return byName.get();
      }
    }
    throw new NotFoundException("STAFF_USER_NOT_FOUND", "Staff user not found");
  }

  @Override
  @Transactional(readOnly = true)
  public StaffUser requireStaffUserForBranch(UUID orgId, UUID branchId, String iamUserId) {
    Optional<StaffUser> byIam = staffUserRepository.findByOrgIdAndIamUserId(orgId, iamUserId);
    if (byIam.isPresent()) {
      return byIam.get();
    }
    Optional<StaffBranchAssignment> byIamBranch =
        assignmentRepository
            .findByBranchIdAndStaffUserIamUserId(branchId, iamUserId)
            .filter(a -> a.getOrg().getId().equals(orgId));
    if (byIamBranch.isPresent()) {
      return byIamBranch.get().getStaffUser();
    }
    String username = principalResolver.require().username();
    if (username != null) {
      Optional<StaffUser> byName = staffUserRepository.findByOrgIdAndUsername(orgId, username);
      if (byName.isPresent()) {
        return byName.get();
      }
      Optional<StaffBranchAssignment> byNameBranch =
          assignmentRepository
              .findByBranchIdAndStaffUserUsername(branchId, username)
              .filter(a -> a.getOrg().getId().equals(orgId));
      if (byNameBranch.isPresent()) {
        return byNameBranch.get().getStaffUser();
      }
    }
    throw new NotFoundException(
        "STAFF_USER_NOT_FOUND",
        "Staff user not found for this organization and branch. "
            + "Register as staff in Admin for this org and ensure you are "
            + "assigned to this branch.");
  }

  @Override
  @Transactional(readOnly = true)
  public Branch findPrimaryBranch(UUID orgId, UUID staffUserId) {
    return assignmentRepository
        .findPrimaryByOrgIdAndStaffUserId(orgId, staffUserId)
        .flatMap(assign -> branchRepository.findByIdAndOrgId(assign.getBranch().getId(), orgId))
        .orElse(null);
  }

  @Override
  @Transactional(readOnly = true)
  public StaffProfile findProfile(UUID orgId, UUID staffUserId) {
    return staffProfileRepository.findByOrgIdAndStaffUserId(orgId, staffUserId).orElse(null);
  }
}
