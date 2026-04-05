package com.blinc.xpos.modules.organization.service;

import com.blinc.xpos.modules.organization.domain.PrinterProfile;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface PrinterProfileService {

  PrinterProfile create(UUID orgId, String name, JsonNode configJson);

  PrinterProfile require(UUID orgId, UUID profileId);

  Page<PrinterProfile> list(UUID orgId, Pageable pageable);

  PrinterProfile update(
      UUID orgId, UUID profileId, String name, JsonNode configJson, Boolean active);
}
