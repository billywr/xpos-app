package com.blinc.xpos.modules.organization.service.impl;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.domain.StaffProfile;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.repository.StaffProfileRepository;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.blinc.xpos.modules.organization.service.StaffProfileService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StaffProfileServiceImpl implements StaffProfileService {

  private final StaffProfileRepository staffProfileRepository;
  private final OrgService orgService;
  private final StaffUserService staffUserService;
  private final BranchService branchService;
  private final Clock clock;

  public StaffProfileServiceImpl(
      StaffProfileRepository staffProfileRepository,
      OrgService orgService,
      StaffUserService staffUserService,
      BranchService branchService,
      Clock clock) {
    this.staffProfileRepository =
        Objects.requireNonNull(staffProfileRepository, "staffProfileRepository");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.staffUserService = Objects.requireNonNull(staffUserService, "staffUserService");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public StaffProfile upsert(
      UUID orgId,
      UUID staffUserId,
      String displayName,
      String phone,
      String email,
      String employeeNo,
      UUID defaultBranchId,
      StatusCommon status) {
    Org org = orgService.require(orgId);
    StaffUser staffUser = staffUserService.require(orgId, staffUserId);

    StaffProfile profile =
        staffProfileRepository
            .findByOrgIdAndStaffUserId(orgId, staffUserId)
            .orElseGet(StaffProfile::new);

    profile.setOrg(org);
    profile.setStaffUser(staffUser);
    profile.setDisplayName(displayName);
    profile.setPhone(phone);
    profile.setEmail(email);
    profile.setEmployeeNo(employeeNo);

    if (defaultBranchId != null) {
      Branch branch = branchService.require(orgId, defaultBranchId);
      profile.setDefaultBranch(branch);
    } else {
      profile.setDefaultBranch(null);
    }

    if (profile.getId() == null) {
      profile.setStatus(StatusCommon.ACTIVE);
      Instant now = Instant.now(clock);
      profile.setCreatedAt(now);
      profile.setUpdatedAt(now);
    }

    if (status != null) {
      profile.setStatus(status);
    }

    profile.setUpdatedAt(Instant.now(clock));
    return staffProfileRepository.save(profile);
  }

  @Override
  @Transactional(readOnly = true)
  public StaffProfile require(UUID orgId, UUID staffUserId) {
    return staffProfileRepository
        .findByOrgIdAndStaffUserId(orgId, staffUserId)
        .orElseThrow(
            () -> new NotFoundException("STAFF_PROFILE_NOT_FOUND", "Staff profile not found"));
  }
}
