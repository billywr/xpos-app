package com.blinc.xpos.modules.catalog.service;

import com.blinc.xpos.modules.catalog.domain.Uom;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface UomService {

  Uom create(UUID orgId, String name, String symbol);

  Uom require(UUID orgId, UUID uomId);

  Page<Uom> list(UUID orgId, Pageable pageable);

  Uom update(UUID orgId, UUID uomId, String name, String symbol);

  void delete(UUID orgId, UUID uomId);
}
