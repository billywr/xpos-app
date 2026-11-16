package com.blinc.xpos.modules.organization.service;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface BranchService {

  Branch create(
      UUID orgId,
      UUID businessId,
      String name,
      String timezone,
      String currency,
      JsonNode addressJson,
      UUID taxAgencyConfigId,
      UUID receiptTemplateId);

  Branch require(UUID orgId, UUID branchId);

  Page<Branch> list(UUID orgId, Pageable pageable);

  Branch update(
      UUID orgId,
      UUID branchId,
      String name,
      String timezone,
      String currency,
      JsonNode addressJson,
      UUID taxAgencyConfigId,
      UUID receiptTemplateId,
      StatusCommon status);

  void softDelete(UUID orgId, UUID branchId);
}
