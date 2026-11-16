package com.blinc.xpos.api.v1.admin.staff.dto;

import java.time.Instant;
import java.util.UUID;

public record StaffBranchAssignmentResponse(
    UUID id, UUID orgId, UUID staffUserId, UUID branchId, boolean primary, Instant createdAt) {}
