package com.blinc.xpos.modules.organization.service.impl;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.repository.OrgRepository;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.blinc.xpos.modules.sales.service.TenderTypeService;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrgServiceImpl implements OrgService {

  private static final String CASH_TENDER_CODE = "CASH";
  private static final String CASH_TENDER_NAME = "Cash";

  private final OrgRepository orgRepository;
  private final TenderTypeService tenderTypeService;
  private final Clock clock;

  public OrgServiceImpl(
      OrgRepository orgRepository,
      @Lazy TenderTypeService tenderTypeService,
      Clock clock) {
    this.orgRepository = Objects.requireNonNull(orgRepository, "orgRepository");
    this.tenderTypeService =
        Objects.requireNonNull(tenderTypeService, "tenderTypeService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public Org create(String name) {
    Org org = new Org();
    org.setName(name);
    org.setStatus(StatusCommon.ACTIVE);
    Instant now = Instant.now(clock);
    org.setCreatedAt(now);
    org.setUpdatedAt(now);
    Org saved = orgRepository.save(org);
    tenderTypeService.create(saved.getId(), CASH_TENDER_CODE, CASH_TENDER_NAME);
    return saved;
  }

  @Override
  @Transactional(readOnly = true)
  public Org require(UUID orgId) {
    return orgRepository
        .findById(orgId)
        .orElseThrow(() -> new NotFoundException("ORG_NOT_FOUND", "Organization not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<Org> list(Pageable pageable) {
    return orgRepository.findAllByStatusIn(
        java.util.List.of(StatusCommon.ACTIVE, StatusCommon.INACTIVE), pageable);
  }

  @Override
  @Transactional
  public Org update(UUID orgId, String name, StatusCommon status) {
    Org org = require(orgId);
    org.setName(name);
    if (status != null) {
      org.setStatus(status);
    }
    org.setUpdatedAt(Instant.now(clock));
    return orgRepository.save(org);
  }

  @Override
  @Transactional
  public void softDelete(UUID orgId) {
    Org org = require(orgId);
    org.setStatus(StatusCommon.DELETED);
    org.setUpdatedAt(Instant.now(clock));
    orgRepository.save(org);
  }
}
