package com.blinc.xpos.modules.compliance.service;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.modules.compliance.domain.VscuConfig;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface VscuConfigService {

  VscuConfig create(UUID orgId, UUID branchId, JsonNode configJson);

  VscuConfig require(UUID orgId, UUID configId);

  Optional<VscuConfig> findByBranch(UUID orgId, UUID branchId);

  Page<VscuConfig> list(UUID orgId, Pageable pageable);

  VscuConfig update(UUID orgId, UUID configId, JsonNode configJson, StatusCommon status);
}
