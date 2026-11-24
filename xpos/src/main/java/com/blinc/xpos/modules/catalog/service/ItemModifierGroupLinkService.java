package com.blinc.xpos.modules.catalog.service;

import com.blinc.xpos.modules.catalog.domain.ItemModifierGroup;
import java.util.List;
import java.util.UUID;

public interface ItemModifierGroupLinkService {

  ItemModifierGroup add(UUID orgId, UUID itemId, UUID modifierGroupId);

  ItemModifierGroup requireInItem(UUID orgId, UUID itemId, UUID itemModifierGroupId);

  List<ItemModifierGroup> listByItem(UUID orgId, UUID itemId);

  List<ItemModifierGroup> listByOrg(UUID orgId);

  void remove(UUID orgId, UUID itemId, UUID itemModifierGroupId);
}
