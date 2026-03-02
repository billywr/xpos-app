package com.blinc.xpos.modules.fraud.service;

import com.blinc.xpos.modules.fraud.domain.ApprovalPolicy;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ApprovalPolicyService {

  ApprovalPolicy create(
      UUID orgId,
      UUID branchId,
      String policyCode,
      BigDecimal thresholdValue,
      Boolean requiresManager);

  ApprovalPolicy require(UUID orgId, UUID policyId);

  Page<ApprovalPolicy> list(UUID orgId, Pageable pageable);
}
