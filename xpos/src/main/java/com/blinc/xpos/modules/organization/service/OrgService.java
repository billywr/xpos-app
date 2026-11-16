package com.blinc.xpos.modules.organization.service;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.modules.organization.domain.Org;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface OrgService {

  Org create(String name);

  Org require(UUID orgId);

  Page<Org> list(Pageable pageable);

  Org update(UUID orgId, String name, StatusCommon status);

  void softDelete(UUID orgId);
}
