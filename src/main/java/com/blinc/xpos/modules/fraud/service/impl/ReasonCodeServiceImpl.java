package com.blinc.xpos.modules.fraud.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.fraud.domain.ReasonCode;
import com.blinc.xpos.modules.fraud.repository.ReasonCodeRepository;
import com.blinc.xpos.modules.fraud.service.ReasonCodeService;
import com.blinc.xpos.modules.organization.service.OrgService;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReasonCodeServiceImpl implements ReasonCodeService {

  private final ReasonCodeRepository reasonCodeRepository;
  private final OrgService orgService;
  private final Clock clock;

  public ReasonCodeServiceImpl(
      ReasonCodeRepository reasonCodeRepository,
      OrgService orgService,
      Clock clock) {
    this.reasonCodeRepository = Objects.requireNonNull(reasonCodeRepository);
    this.orgService = Objects.requireNonNull(orgService);
    this.clock = Objects.requireNonNull(clock);
  }

  @Override
  @Transactional
  public ReasonCode create(UUID orgId, String code, String description) {
    var org = orgService.require(orgId);
    ReasonCode entity = new ReasonCode();
    entity.setOrg(org);
    entity.setCode(code != null ? code.trim() : "");
    entity.setDescription(description != null ? description.trim() : "");
    entity.setActive(true);
    entity.setCreatedAt(Instant.now(clock));
    return reasonCodeRepository.save(entity);
  }

  @Override
  @Transactional(readOnly = true)
  public ReasonCode require(UUID orgId, UUID reasonCodeId) {
    return reasonCodeRepository
        .findByIdAndOrgId(reasonCodeId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "REASON_CODE_NOT_FOUND", "Reason code not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<ReasonCode> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return reasonCodeRepository.findAllByOrgId(orgId, pageable);
  }

  @Override
  @Transactional
  public ReasonCode update(UUID orgId, UUID reasonCodeId, String description, Boolean active) {
    ReasonCode entity = require(orgId, reasonCodeId);
    if (description != null) {
      entity.setDescription(description.trim());
    }
    if (active != null) {
      entity.setActive(active);
    }
    return reasonCodeRepository.save(entity);
  }
}
