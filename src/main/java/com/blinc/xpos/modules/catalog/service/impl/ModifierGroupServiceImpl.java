package com.blinc.xpos.modules.catalog.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.catalog.domain.ModifierGroup;
import com.blinc.xpos.modules.catalog.repository.ModifierGroupRepository;
import com.blinc.xpos.modules.catalog.service.ModifierGroupService;
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
public class ModifierGroupServiceImpl implements ModifierGroupService {

  private final ModifierGroupRepository modifierGroupRepository;
  private final OrgService orgService;
  private final Clock clock;

  public ModifierGroupServiceImpl(
      ModifierGroupRepository modifierGroupRepository, OrgService orgService, Clock clock) {
    this.modifierGroupRepository =
        Objects.requireNonNull(modifierGroupRepository, "modifierGroupRepository");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public ModifierGroup create(
      UUID orgId, String name, int minSelect, int maxSelect, boolean required) {
    var org = orgService.require(orgId);
    ModifierGroup group = new ModifierGroup();
    group.setOrg(org);
    group.setName(name);
    group.setMinSelect(minSelect);
    group.setMaxSelect(maxSelect);
    group.setRequired(required);
    Instant now = Instant.now(clock);
    group.setCreatedAt(now);
    group.setUpdatedAt(now);
    return modifierGroupRepository.save(group);
  }

  @Override
  @Transactional(readOnly = true)
  public ModifierGroup require(UUID orgId, UUID modifierGroupId) {
    return modifierGroupRepository
        .findByIdAndOrgId(modifierGroupId, orgId)
        .orElseThrow(
            () -> new NotFoundException("MODIFIER_GROUP_NOT_FOUND", "Modifier group not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<ModifierGroup> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return modifierGroupRepository.findAllByOrgId(orgId, pageable);
  }

  @Override
  @Transactional
  public ModifierGroup update(
      UUID orgId,
      UUID modifierGroupId,
      String name,
      int minSelect,
      int maxSelect,
      boolean required) {
    ModifierGroup group = require(orgId, modifierGroupId);
    group.setName(name);
    group.setMinSelect(minSelect);
    group.setMaxSelect(maxSelect);
    group.setRequired(required);
    group.setUpdatedAt(Instant.now(clock));
    return modifierGroupRepository.save(group);
  }
}
