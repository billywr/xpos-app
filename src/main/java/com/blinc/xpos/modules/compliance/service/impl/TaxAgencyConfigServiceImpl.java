package com.blinc.xpos.modules.compliance.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.compliance.domain.TaxAgencyConfig;
import com.blinc.xpos.modules.compliance.repository.TaxAgencyConfigRepository;
import com.blinc.xpos.modules.compliance.service.TaxAgencyConfigService;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TaxAgencyConfigServiceImpl implements TaxAgencyConfigService {

  private final TaxAgencyConfigRepository taxAgencyConfigRepository;
  private final OrgService orgService;
  private final Clock clock;

  public TaxAgencyConfigServiceImpl(
      TaxAgencyConfigRepository taxAgencyConfigRepository, OrgService orgService, Clock clock) {
    this.taxAgencyConfigRepository = Objects.requireNonNull(taxAgencyConfigRepository);
    this.orgService = Objects.requireNonNull(orgService);
    this.clock = Objects.requireNonNull(clock);
  }

  @Override
  @Transactional
  public TaxAgencyConfig create(
      UUID orgId,
      String name,
      BigDecimal vatStandardRate,
      BigDecimal vatReducedRate,
      Boolean supportsEtims,
      JsonNode etimsMappingJson) {
    var org = orgService.require(orgId);
    Instant now = Instant.now(clock);
    TaxAgencyConfig entity = new TaxAgencyConfig();
    entity.setOrg(org);
    entity.setName(name != null ? name.trim() : "");
    entity.setVatStandardRate(vatStandardRate != null ? vatStandardRate : BigDecimal.ZERO);
    entity.setVatReducedRate(vatReducedRate != null ? vatReducedRate : BigDecimal.ZERO);
    entity.setSupportsEtims(Boolean.TRUE.equals(supportsEtims));
    entity.setEtimsMappingJson(etimsMappingJson);
    entity.setCreatedAt(now);
    entity.setUpdatedAt(now);
    return taxAgencyConfigRepository.save(entity);
  }

  @Override
  @Transactional(readOnly = true)
  public TaxAgencyConfig require(UUID orgId, UUID configId) {
    return taxAgencyConfigRepository
        .findByIdAndOrgId(configId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "TAX_AGENCY_CONFIG_NOT_FOUND", "Tax agency config not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<TaxAgencyConfig> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return taxAgencyConfigRepository.findAllByOrgId(orgId, pageable);
  }

  @Override
  @Transactional
  public TaxAgencyConfig update(
      UUID orgId,
      UUID configId,
      String name,
      BigDecimal vatStandardRate,
      BigDecimal vatReducedRate,
      Boolean supportsEtims,
      JsonNode etimsMappingJson) {
    TaxAgencyConfig entity = require(orgId, configId);
    if (name != null) {
      entity.setName(name.trim());
    }
    if (vatStandardRate != null) {
      entity.setVatStandardRate(vatStandardRate);
    }
    if (vatReducedRate != null) {
      entity.setVatReducedRate(vatReducedRate);
    }
    if (supportsEtims != null) {
      entity.setSupportsEtims(supportsEtims);
    }
    if (etimsMappingJson != null) {
      entity.setEtimsMappingJson(etimsMappingJson);
    }
    entity.setUpdatedAt(Instant.now(clock));
    return taxAgencyConfigRepository.save(entity);
  }
}
