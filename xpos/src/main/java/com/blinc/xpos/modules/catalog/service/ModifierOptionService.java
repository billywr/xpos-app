package com.blinc.xpos.modules.catalog.service;

import com.blinc.xpos.modules.catalog.domain.ModifierOption;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ModifierOptionService {

  ModifierOption create(
      UUID orgId, UUID modifierGroupId, String name, BigDecimal priceDelta, UUID itemId);

  ModifierOption require(UUID orgId, UUID modifierOptionId);

  ModifierOption requireInGroup(UUID orgId, UUID modifierGroupId, UUID modifierOptionId);

  Page<ModifierOption> listByGroup(UUID orgId, UUID modifierGroupId, Pageable pageable);

  ModifierOption update(
      UUID orgId, UUID modifierOptionId, String name, BigDecimal priceDelta, UUID itemId);
}
