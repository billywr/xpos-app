package com.blinc.xpos.modules.pricing.service;

import com.blinc.xpos.common.constants.enums.VatCategory;
import com.blinc.xpos.modules.pricing.domain.TaxProfile;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface TaxProfileService {

  TaxProfile create(
      UUID orgId,
      String name,
      VatCategory vatCategory,
      BigDecimal serviceChargeRate,
      BigDecimal levyRate);

  TaxProfile require(UUID orgId, UUID taxProfileId);

  Page<TaxProfile> list(UUID orgId, Pageable pageable);

  TaxProfile update(
      UUID orgId,
      UUID taxProfileId,
      String name,
      VatCategory vatCategory,
      BigDecimal serviceChargeRate,
      BigDecimal levyRate);
}
