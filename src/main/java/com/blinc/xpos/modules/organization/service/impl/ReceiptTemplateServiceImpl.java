package com.blinc.xpos.modules.organization.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.organization.domain.ReceiptTemplate;
import com.blinc.xpos.modules.organization.repository.ReceiptTemplateRepository;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.blinc.xpos.modules.organization.service.ReceiptTemplateService;
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
public class ReceiptTemplateServiceImpl implements ReceiptTemplateService {

  private final ReceiptTemplateRepository receiptTemplateRepository;
  private final OrgService orgService;
  private final Clock clock;

  public ReceiptTemplateServiceImpl(
      ReceiptTemplateRepository receiptTemplateRepository, OrgService orgService, Clock clock) {
    this.receiptTemplateRepository =
        Objects.requireNonNull(receiptTemplateRepository, "receiptTemplateRepository");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public ReceiptTemplate create(UUID orgId, String name, JsonNode templateJson) {
    var org = orgService.require(orgId);
    ReceiptTemplate template = new ReceiptTemplate();
    template.setOrg(org);
    template.setName(name != null ? name.trim() : "");
    template.setTemplateJson(
        templateJson != null ? templateJson : JsonNodeFactory.instance.objectNode());
    template.setActive(true);
    Instant now = Instant.now(clock);
    template.setCreatedAt(now);
    template.setUpdatedAt(now);
    return receiptTemplateRepository.save(template);
  }

  @Override
  @Transactional(readOnly = true)
  public ReceiptTemplate require(UUID orgId, UUID templateId) {
    return receiptTemplateRepository
        .findByIdAndOrgId(templateId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException("RECEIPT_TEMPLATE_NOT_FOUND", "Receipt template not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<ReceiptTemplate> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return receiptTemplateRepository.findAllByOrgId(orgId, pageable);
  }

  @Override
  @Transactional
  public ReceiptTemplate update(
      UUID orgId, UUID templateId, String name, JsonNode templateJson, Boolean active) {
    ReceiptTemplate template = require(orgId, templateId);
    if (name != null) {
      template.setName(name.trim());
    }
    if (templateJson != null) {
      template.setTemplateJson(templateJson);
    }
    if (active != null) {
      template.setActive(active);
    }
    template.setUpdatedAt(Instant.now(clock));
    return receiptTemplateRepository.save(template);
  }
}
