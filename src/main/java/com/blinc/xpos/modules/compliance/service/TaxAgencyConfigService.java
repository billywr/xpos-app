package com.blinc.xpos.modules.compliance.service;

import com.blinc.xpos.modules.compliance.domain.TaxAgencyConfig;
import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface TaxAgencyConfigService {

  TaxAgencyConfig create(
      UUID orgId,
      String name,
      BigDecimal vatStandardRate,
      BigDecimal vatReducedRate,
      Boolean supportsEtims,
      JsonNode etimsMappingJson);

  TaxAgencyConfig require(UUID orgId, UUID configId);

  Page<TaxAgencyConfig> list(UUID orgId, Pageable pageable);

  TaxAgencyConfig update(
      UUID orgId,
      UUID configId,
      String name,
      BigDecimal vatStandardRate,
      BigDecimal vatReducedRate,
      Boolean supportsEtims,
      JsonNode etimsMappingJson);
}
