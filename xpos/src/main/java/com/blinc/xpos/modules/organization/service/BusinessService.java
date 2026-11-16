package com.blinc.xpos.modules.organization.service;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.modules.organization.domain.Business;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface BusinessService {

  Business create(
      UUID orgId, String legalName, String kraPin, String logoUrl, String receiptFooter);

  Business require(UUID orgId, UUID businessId);

  Page<Business> list(UUID orgId, Pageable pageable);

  Business update(
      UUID orgId,
      UUID businessId,
      String legalName,
      String kraPin,
      String logoUrl,
      String receiptFooter,
      StatusCommon status);

  void softDelete(UUID orgId, UUID businessId);
}
