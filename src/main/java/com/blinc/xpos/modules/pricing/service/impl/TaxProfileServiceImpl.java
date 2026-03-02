package com.blinc.xpos.modules.pricing.service.impl;

import com.blinc.xpos.common.constants.enums.VatCategory;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.blinc.xpos.modules.pricing.domain.TaxProfile;
import com.blinc.xpos.modules.pricing.repository.TaxProfileRepository;
import com.blinc.xpos.modules.pricing.service.TaxProfileService;
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
public class TaxProfileServiceImpl implements TaxProfileService {

  private final TaxProfileRepository taxProfileRepository;
  private final OrgService orgService;
  private final Clock clock;

  public TaxProfileServiceImpl(
      TaxProfileRepository taxProfileRepository, OrgService orgService, Clock clock) {
    this.taxProfileRepository =
        Objects.requireNonNull(taxProfileRepository, "taxProfileRepository");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public TaxProfile create(
      UUID orgId,
      String name,
      VatCategory vatCategory,
      BigDecimal serviceChargeRate,
      BigDecimal levyRate) {
    var org = orgService.require(orgId);
    TaxProfile profile = new TaxProfile();
    profile.setOrg(org);
    profile.setName(name);
    profile.setVatCategory(vatCategory);
    profile.setServiceChargeRate(serviceChargeRate);
    profile.setLevyRate(levyRate);
    Instant now = Instant.now(clock);
    profile.setCreatedAt(now);
    profile.setUpdatedAt(now);
    return taxProfileRepository.save(profile);
  }

  @Override
  @Transactional(readOnly = true)
  public TaxProfile require(UUID orgId, UUID taxProfileId) {
    return taxProfileRepository
        .findByIdAndOrgId(taxProfileId, orgId)
        .orElseThrow(() -> new NotFoundException("TAX_PROFILE_NOT_FOUND", "Tax profile not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<TaxProfile> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return taxProfileRepository.findAllByOrgId(orgId, pageable);
  }

  @Override
  @Transactional
  public TaxProfile update(
      UUID orgId,
      UUID taxProfileId,
      String name,
      VatCategory vatCategory,
      BigDecimal serviceChargeRate,
      BigDecimal levyRate) {
    TaxProfile profile = require(orgId, taxProfileId);
    profile.setName(name);
    profile.setVatCategory(vatCategory);
    profile.setServiceChargeRate(serviceChargeRate);
    profile.setLevyRate(levyRate);
    profile.setUpdatedAt(Instant.now(clock));
    return taxProfileRepository.save(profile);
  }
}
