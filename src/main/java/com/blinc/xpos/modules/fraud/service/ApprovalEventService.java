package com.blinc.xpos.modules.fraud.service;

import com.blinc.xpos.common.constants.enums.ApprovalType;
import com.blinc.xpos.modules.fraud.domain.ApprovalEvent;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ApprovalEventService {

  ApprovalEvent create(
      UUID orgId,
      UUID branchId,
      UUID approvedByStaffUserId,
      UUID requestedByStaffUserId,
      ApprovalType approvalType,
      String targetEntityType,
      UUID targetEntityId,
      UUID reasonCodeId);

  ApprovalEvent require(UUID orgId, UUID eventId);

  Page<ApprovalEvent> listByBranch(UUID orgId, UUID branchId, Pageable pageable);
}
