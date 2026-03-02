package com.blinc.xpos.modules.sales.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.sales.domain.TableArea;
import com.blinc.xpos.modules.sales.repository.TableAreaRepository;
import com.blinc.xpos.modules.sales.service.TableAreaService;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TableAreaServiceImpl implements TableAreaService {

  private final TableAreaRepository tableAreaRepository;
  private final BranchService branchService;
  private final Clock clock;

  public TableAreaServiceImpl(
      TableAreaRepository tableAreaRepository,
      BranchService branchService,
      Clock clock) {
    this.tableAreaRepository =
        Objects.requireNonNull(tableAreaRepository, "tableAreaRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public TableArea create(UUID orgId, UUID branchId, String name) {
    Branch branch = branchService.require(orgId, branchId);
    TableArea area = new TableArea();
    area.setOrg(branch.getOrg());
    area.setBranch(branch);
    area.setName(name);
    area.setCreatedAt(Instant.now(clock));
    return tableAreaRepository.save(area);
  }

  @Override
  @Transactional(readOnly = true)
  public TableArea require(UUID orgId, UUID tableAreaId) {
    return tableAreaRepository
        .findByIdAndOrgId(tableAreaId, orgId)
        .orElseThrow(
            () -> new NotFoundException("TABLE_AREA_NOT_FOUND", "Table area not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<TableArea> listByBranch(UUID orgId, UUID branchId, Pageable pageable) {
    branchService.require(orgId, branchId);
    return tableAreaRepository.findAllByBranchIdAndOrgId(branchId, orgId, pageable);
  }

  @Override
  @Transactional
  public TableArea update(UUID orgId, UUID tableAreaId, String name) {
    TableArea area = require(orgId, tableAreaId);
    area.setName(name);
    return tableAreaRepository.save(area);
  }
}
