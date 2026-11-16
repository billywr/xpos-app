package com.blinc.xpos.modules.catalog.service.impl;

import com.blinc.xpos.common.error.ConflictException;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.catalog.domain.Uom;
import com.blinc.xpos.modules.catalog.repository.ItemRepository;
import com.blinc.xpos.modules.catalog.repository.ItemUomRepository;
import com.blinc.xpos.modules.catalog.repository.UomRepository;
import com.blinc.xpos.modules.catalog.service.UomService;
import com.blinc.xpos.modules.organization.service.OrgService;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UomServiceImpl implements UomService {

  private final UomRepository uomRepository;
  private final ItemRepository itemRepository;
  private final ItemUomRepository itemUomRepository;
  private final OrgService orgService;
  private final Clock clock;

  public UomServiceImpl(
      UomRepository uomRepository,
      ItemRepository itemRepository,
      ItemUomRepository itemUomRepository,
      OrgService orgService,
      Clock clock) {
    this.uomRepository = Objects.requireNonNull(uomRepository, "uomRepository");
    this.itemRepository = Objects.requireNonNull(itemRepository, "itemRepository");
    this.itemUomRepository = Objects.requireNonNull(itemUomRepository, "itemUomRepository");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public Uom create(UUID orgId, String name, String symbol) {
    var org = orgService.require(orgId);
    Uom uom = new Uom();
    uom.setOrg(org);
    uom.setName(name);
    uom.setSymbol(symbol);
    uom.setCreatedAt(Instant.now(clock));
    return uomRepository.save(uom);
  }

  @Override
  @Transactional(readOnly = true)
  public Uom require(UUID orgId, UUID uomId) {
    return uomRepository
        .findByIdAndOrgId(uomId, orgId)
        .orElseThrow(() -> new NotFoundException("UOM_NOT_FOUND", "Unit of measure not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<Uom> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return uomRepository.findAllByOrgId(orgId, pageable);
  }

  @Override
  @Transactional
  public Uom update(UUID orgId, UUID uomId, String name, String symbol) {
    Uom uom = require(orgId, uomId);
    uom.setName(name);
    uom.setSymbol(symbol);
    return uomRepository.save(uom);
  }

  @Override
  @Transactional
  public void delete(UUID orgId, UUID uomId) {
    Uom uom = require(orgId, uomId);
    if (itemRepository.countByOrgIdAndBaseUomId(orgId, uomId) > 0) {
      throw new ConflictException(
          "UOM_IN_USE",
          "Cannot delete UOM: it is used as base unit for items. Change or delete those items first.");
    }
    if (itemUomRepository.countByOrgIdAndUomId(orgId, uomId) > 0) {
      throw new ConflictException(
          "UOM_IN_USE",
          "Cannot delete UOM: it is used in item UOM conversions. Remove those conversions first.");
    }
    uomRepository.delete(uom);
  }
}
