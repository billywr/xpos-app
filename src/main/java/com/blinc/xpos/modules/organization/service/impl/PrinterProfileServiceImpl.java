package com.blinc.xpos.modules.organization.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.organization.domain.PrinterProfile;
import com.blinc.xpos.modules.organization.repository.PrinterProfileRepository;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.blinc.xpos.modules.organization.service.PrinterProfileService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PrinterProfileServiceImpl implements PrinterProfileService {

  private final PrinterProfileRepository printerProfileRepository;
  private final OrgService orgService;
  private final Clock clock;

  public PrinterProfileServiceImpl(
      PrinterProfileRepository printerProfileRepository, OrgService orgService, Clock clock) {
    this.printerProfileRepository =
        Objects.requireNonNull(printerProfileRepository, "printerProfileRepository");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public PrinterProfile create(UUID orgId, String name, JsonNode configJson) {
    var org = orgService.require(orgId);
    PrinterProfile profile = new PrinterProfile();
    profile.setOrg(org);
    profile.setName(name != null ? name.trim() : "");
    profile.setConfigJson(configJson != null ? configJson : JsonNodeFactory.instance.objectNode());
    profile.setActive(true);
    Instant now = Instant.now(clock);
    profile.setCreatedAt(now);
    profile.setUpdatedAt(now);
    return printerProfileRepository.save(profile);
  }

  @Override
  @Transactional(readOnly = true)
  public PrinterProfile require(UUID orgId, UUID profileId) {
    return printerProfileRepository
        .findByIdAndOrgId(profileId, orgId)
        .orElseThrow(
            () -> new NotFoundException("PRINTER_PROFILE_NOT_FOUND", "Printer profile not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<PrinterProfile> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return printerProfileRepository.findAllByOrgId(orgId, pageable);
  }

  @Override
  @Transactional
  public PrinterProfile update(
      UUID orgId, UUID profileId, String name, JsonNode configJson, Boolean active) {
    PrinterProfile profile = require(orgId, profileId);
    if (name != null) {
      profile.setName(name.trim());
    }
    if (configJson != null) {
      profile.setConfigJson(configJson);
    }
    if (active != null) {
      profile.setActive(active);
    }
    profile.setUpdatedAt(Instant.now(clock));
    return printerProfileRepository.save(profile);
  }
}
