package com.blinc.xpos.modules.catalog.service;

import com.blinc.xpos.modules.catalog.domain.ModifierGroup;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ModifierGroupService {

  ModifierGroup create(UUID orgId, String name, int minSelect, int maxSelect, boolean required);

  ModifierGroup require(UUID orgId, UUID modifierGroupId);

  Page<ModifierGroup> list(UUID orgId, Pageable pageable);

  ModifierGroup update(
      UUID orgId,
      UUID modifierGroupId,
      String name,
      int minSelect,
      int maxSelect,
      boolean required);
}
