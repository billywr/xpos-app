package com.blinc.xpos.modules.sales.service;

import com.blinc.xpos.modules.sales.domain.TenderType;
import java.util.List;
import java.util.UUID;

public interface TenderTypeService {

  TenderType create(UUID orgId, String code, String name);

  TenderType require(UUID orgId, UUID tenderTypeId);

  List<TenderType> listActiveByOrg(UUID orgId);

  List<TenderType> listByOrg(UUID orgId);

  TenderType update(UUID orgId, UUID tenderTypeId, String code, String name, boolean active);

  void delete(UUID orgId, UUID tenderTypeId);
}
