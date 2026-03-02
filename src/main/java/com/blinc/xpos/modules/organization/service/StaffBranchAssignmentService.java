package com.blinc.xpos.modules.organization.service;

import com.blinc.xpos.modules.organization.domain.StaffBranchAssignment;
import java.util.List;
import java.util.UUID;

public interface StaffBranchAssignmentService {

  StaffBranchAssignment assign(UUID orgId, UUID staffUserId, UUID branchId, boolean primary);

  List<StaffBranchAssignment> list(UUID orgId, UUID staffUserId);

  StaffBranchAssignment requirePrimary(UUID orgId, UUID staffUserId);
}
