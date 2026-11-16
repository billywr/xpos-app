package com.blinc.xpos.api.v1.admin.staff.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record StaffBranchAssignmentCreateRequest(
    @NotNull(message = "branchId is required") UUID branchId, boolean primary) {}
