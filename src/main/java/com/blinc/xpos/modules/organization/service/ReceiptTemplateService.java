package com.blinc.xpos.modules.organization.service;

import com.blinc.xpos.modules.organization.domain.ReceiptTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ReceiptTemplateService {

  ReceiptTemplate create(UUID orgId, String name, JsonNode templateJson);

  ReceiptTemplate require(UUID orgId, UUID templateId);

  Page<ReceiptTemplate> list(UUID orgId, Pageable pageable);

  ReceiptTemplate update(UUID orgId, UUID templateId, String name, JsonNode templateJson, Boolean active);
}
