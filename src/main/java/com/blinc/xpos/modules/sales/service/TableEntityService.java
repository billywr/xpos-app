package com.blinc.xpos.modules.sales.service;

import com.blinc.xpos.modules.sales.domain.TableEntity;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface TableEntityService {

  TableEntity create(UUID orgId, UUID branchId, UUID tableAreaId, String name, Integer capacity);

  TableEntity require(UUID orgId, UUID tableEntityId);

  Page<TableEntity> listByBranch(UUID orgId, UUID branchId, Pageable pageable);

  TableEntity update(
      UUID orgId, UUID tableEntityId, UUID tableAreaId, String name, Integer capacity, String status);
}
