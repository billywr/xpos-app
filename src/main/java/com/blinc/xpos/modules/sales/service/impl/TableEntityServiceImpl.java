package com.blinc.xpos.modules.sales.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.sales.domain.TableArea;
import com.blinc.xpos.modules.sales.domain.TableEntity;
import com.blinc.xpos.modules.sales.repository.TableEntityRepository;
import com.blinc.xpos.modules.sales.service.TableAreaService;
import com.blinc.xpos.modules.sales.service.TableEntityService;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TableEntityServiceImpl implements TableEntityService {

  private static final String DEFAULT_STATUS = "ACTIVE";

  private final TableEntityRepository tableEntityRepository;
  private final BranchService branchService;
  private final TableAreaService tableAreaService;
  private final Clock clock;

  public TableEntityServiceImpl(
      TableEntityRepository tableEntityRepository,
      BranchService branchService,
      TableAreaService tableAreaService,
      Clock clock) {
    this.tableEntityRepository =
        Objects.requireNonNull(tableEntityRepository, "tableEntityRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.tableAreaService = Objects.requireNonNull(tableAreaService, "tableAreaService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public TableEntity create(
      UUID orgId, UUID branchId, UUID tableAreaId, String name, Integer capacity) {
    Branch branch = branchService.require(orgId, branchId);
    TableEntity entity = new TableEntity();
    entity.setOrg(branch.getOrg());
    entity.setBranch(branch);
    if (tableAreaId != null) {
      TableArea area = tableAreaService.require(orgId, tableAreaId);
      entity.setTableArea(area);
    }
    entity.setName(name);
    entity.setCapacity(capacity);
    entity.setStatus(DEFAULT_STATUS);
    entity.setCreatedAt(Instant.now(clock));
    return tableEntityRepository.save(entity);
  }

  @Override
  @Transactional(readOnly = true)
  public TableEntity require(UUID orgId, UUID tableEntityId) {
    return tableEntityRepository
        .findByIdAndOrgId(tableEntityId, orgId)
        .orElseThrow(
            () -> new NotFoundException("TABLE_ENTITY_NOT_FOUND", "Table not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<TableEntity> listByBranch(UUID orgId, UUID branchId, Pageable pageable) {
    branchService.require(orgId, branchId);
    return tableEntityRepository.findAllByBranchIdAndOrgId(branchId, orgId, pageable);
  }

  @Override
  @Transactional
  public TableEntity update(
      UUID orgId,
      UUID tableEntityId,
      UUID tableAreaId,
      String name,
      Integer capacity,
      String status) {
    TableEntity entity = require(orgId, tableEntityId);
    if (tableAreaId != null) {
      entity.setTableArea(tableAreaService.require(orgId, tableAreaId));
    } else {
      entity.setTableArea(null);
    }
    if (name != null) {
      entity.setName(name);
    }
    if (capacity != null) {
      entity.setCapacity(capacity);
    }
    if (status != null && !status.isBlank()) {
      entity.setStatus(status);
    }
    return tableEntityRepository.save(entity);
  }
}
