package com.blinc.xpos.modules.compliance.service.impl;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.compliance.domain.VscuConfig;
import com.blinc.xpos.modules.compliance.repository.VscuConfigRepository;
import com.blinc.xpos.modules.compliance.service.VscuConfigService;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VscuConfigServiceImpl implements VscuConfigService {

  private final VscuConfigRepository vscuConfigRepository;
  private final OrgService orgService;
  private final BranchService branchService;
  private final Clock clock;

  public VscuConfigServiceImpl(
      VscuConfigRepository vscuConfigRepository,
      OrgService orgService,
      BranchService branchService,
      Clock clock) {
    this.vscuConfigRepository = Objects.requireNonNull(vscuConfigRepository);
    this.orgService = Objects.requireNonNull(orgService);
    this.branchService = Objects.requireNonNull(branchService);
    this.clock = Objects.requireNonNull(clock);
  }

  @Override
  @Transactional
  public VscuConfig create(UUID orgId, UUID branchId, JsonNode configJson) {
    var branch = branchService.require(orgId, branchId);
    if (vscuConfigRepository.findByOrgIdAndBranchId(orgId, branchId).isPresent()) {
      throw new IllegalArgumentException("VSCU config already exists for this branch");
    }
    if (configJson == null) {
      throw new IllegalArgumentException("configJson is required");
    }
    Instant now = Instant.now(clock);
    VscuConfig entity = new VscuConfig();
    entity.setOrg(branch.getOrg());
    entity.setBranch(branch);
    entity.setConfigJson(configJson);
    entity.setStatus(StatusCommon.ACTIVE);
    entity.setCreatedAt(now);
    entity.setUpdatedAt(now);
    return vscuConfigRepository.save(entity);
  }

  @Override
  @Transactional(readOnly = true)
  public VscuConfig require(UUID orgId, UUID configId) {
    return vscuConfigRepository
        .findByIdAndOrgId(configId, orgId)
        .orElseThrow(() -> new NotFoundException("VSCU_CONFIG_NOT_FOUND", "VSCU config not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<VscuConfig> findByBranch(UUID orgId, UUID branchId) {
    branchService.require(orgId, branchId);
    return vscuConfigRepository.findByOrgIdAndBranchId(orgId, branchId);
  }

  @Override
  @Transactional(readOnly = true)
  public Page<VscuConfig> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return vscuConfigRepository.findAllByOrgId(orgId, pageable);
  }

  @Override
  @Transactional
  public VscuConfig update(UUID orgId, UUID configId, JsonNode configJson, StatusCommon status) {
    VscuConfig entity = require(orgId, configId);
    if (configJson != null) {
      entity.setConfigJson(configJson);
    }
    if (status != null) {
      entity.setStatus(status);
    }
    entity.setUpdatedAt(Instant.now(clock));
    return vscuConfigRepository.save(entity);
  }
}
