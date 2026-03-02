package com.blinc.xpos.modules.organization.service;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface StaffUserService {

  StaffUser create(UUID orgId, String iamUserId, String username);

  StaffUser require(UUID orgId, UUID staffUserId);

  StaffUser requireByIamUserId(UUID orgId, String iamUserId);

  Page<StaffUser> list(UUID orgId, Pageable pageable);

  StaffUser updateStatus(UUID orgId, UUID staffUserId, StatusCommon status);

  void softDelete(UUID orgId, UUID staffUserId);
}
