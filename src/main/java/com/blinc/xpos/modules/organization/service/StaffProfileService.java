package com.blinc.xpos.modules.organization.service;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.modules.organization.domain.StaffProfile;
import java.util.UUID;

public interface StaffProfileService {

  StaffProfile upsert(
      UUID orgId,
      UUID staffUserId,
      String displayName,
      String phone,
      String email,
      String employeeNo,
      UUID defaultBranchId,
      StatusCommon status);

  StaffProfile require(UUID orgId, UUID staffUserId);
}
