package com.blinc.xpos.modules.sales.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.blinc.xpos.modules.sales.domain.TenderType;
import com.blinc.xpos.modules.sales.repository.TenderTypeRepository;
import com.blinc.xpos.modules.sales.service.TenderTypeService;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TenderTypeServiceImpl implements TenderTypeService {

  private final TenderTypeRepository tenderTypeRepository;
  private final OrgService orgService;
  private final Clock clock;

  public TenderTypeServiceImpl(
      TenderTypeRepository tenderTypeRepository,
      OrgService orgService,
      Clock clock) {
    this.tenderTypeRepository =
        Objects.requireNonNull(tenderTypeRepository, "tenderTypeRepository");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public TenderType create(UUID orgId, String code, String name) {
    var org = orgService.require(orgId);
    TenderType type = new TenderType();
    type.setOrg(org);
    type.setCode(code);
    type.setName(name);
    type.setActive(true);
    type.setCreatedAt(Instant.now(clock));
    return tenderTypeRepository.save(type);
  }

  @Override
  @Transactional(readOnly = true)
  public TenderType require(UUID orgId, UUID tenderTypeId) {
    return tenderTypeRepository
        .findByIdAndOrgId(tenderTypeId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "TENDER_TYPE_NOT_FOUND", "Tender type not found: " + tenderTypeId));
  }

  @Override
  @Transactional(readOnly = true)
  public List<TenderType> listActiveByOrg(UUID orgId) {
    return tenderTypeRepository.findByOrgIdAndActiveTrue(orgId);
  }

  @Override
  @Transactional(readOnly = true)
  public List<TenderType> listByOrg(UUID orgId) {
    return tenderTypeRepository.findAllByOrgIdOrderByCode(orgId);
  }

  @Override
  @Transactional
  public TenderType update(
      UUID orgId, UUID tenderTypeId, String code, String name, boolean active) {
    TenderType type = require(orgId, tenderTypeId);
    type.setCode(code);
    type.setName(name);
    type.setActive(active);
    return tenderTypeRepository.save(type);
  }

  @Override
  @Transactional
  public void delete(UUID orgId, UUID tenderTypeId) {
    TenderType type = require(orgId, tenderTypeId);
    type.setActive(false);
    tenderTypeRepository.save(type);
  }
}
