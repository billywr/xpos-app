package com.blinc.xpos.modules.fraud.service;

import com.blinc.xpos.modules.fraud.domain.ReasonCode;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ReasonCodeService {

  ReasonCode create(UUID orgId, String code, String description);

  ReasonCode require(UUID orgId, UUID reasonCodeId);

  Page<ReasonCode> list(UUID orgId, Pageable pageable);

  ReasonCode update(UUID orgId, UUID reasonCodeId, String description, Boolean active);
}
