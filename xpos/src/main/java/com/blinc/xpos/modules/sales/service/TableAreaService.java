package com.blinc.xpos.modules.sales.service;

import com.blinc.xpos.modules.sales.domain.TableArea;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface TableAreaService {

  TableArea create(UUID orgId, UUID branchId, String name);

  TableArea require(UUID orgId, UUID tableAreaId);

  Page<TableArea> listByBranch(UUID orgId, UUID branchId, Pageable pageable);

  TableArea update(UUID orgId, UUID tableAreaId, String name);
}
