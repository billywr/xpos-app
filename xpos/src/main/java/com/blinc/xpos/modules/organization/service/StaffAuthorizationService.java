package com.blinc.xpos.modules.organization.service;

import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.StaffProfile;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import java.util.UUID;

public interface StaffAuthorizationService {

  StaffUser requireStaffUser(UUID orgId, String iamUserId);

  /**
   * Resolves staff user for operator actions: first by (orgId, iamUserId), then by branch
   * assignment (staff assigned to this branch with this iamUserId). Ensures the resolved user
   * belongs to the given org.
   */
  StaffUser requireStaffUserForBranch(UUID orgId, UUID branchId, String iamUserId);

  Branch findPrimaryBranch(UUID orgId, UUID staffUserId);

  StaffProfile findProfile(UUID orgId, UUID staffUserId);
}
