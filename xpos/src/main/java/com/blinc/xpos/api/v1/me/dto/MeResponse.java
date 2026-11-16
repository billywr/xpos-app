package com.blinc.xpos.api.v1.me.dto;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import java.util.UUID;

public record MeResponse(
    UUID orgId,
    String iamUserId,
    String username,
    UUID staffUserId,
    StatusCommon staffStatus,
    MeStaffProfileResponse profile,
    UUID primaryBranchId) {}
