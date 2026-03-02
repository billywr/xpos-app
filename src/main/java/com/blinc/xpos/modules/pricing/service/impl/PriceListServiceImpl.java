package com.blinc.xpos.modules.pricing.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.blinc.xpos.modules.pricing.domain.PriceList;
import com.blinc.xpos.modules.pricing.repository.PriceListRepository;
import com.blinc.xpos.modules.pricing.service.PriceListService;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PriceListServiceImpl implements PriceListService {

  private final PriceListRepository priceListRepository;
  private final OrgService orgService;
  private final BranchService branchService;
  private final Clock clock;

  public PriceListServiceImpl(
      PriceListRepository priceListRepository,
      OrgService orgService,
      BranchService branchService,
      Clock clock) {
    this.priceListRepository =
        Objects.requireNonNull(priceListRepository, "priceListRepository");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public PriceList create(
      UUID orgId,
      UUID branchId,
      String channel,
      String name,
      int priority,
      boolean active) {
    Org org = orgService.require(orgId);
    Branch branch = branchId != null ? branchService.require(orgId, branchId) : null;
    PriceList list = new PriceList();
    list.setOrg(org);
    list.setBranch(branch);
    list.setChannel(channel);
    list.setName(name);
    list.setPriority(priority);
    list.setActive(active);
    Instant now = Instant.now(clock);
    list.setCreatedAt(now);
    list.setUpdatedAt(now);
    return priceListRepository.save(list);
  }

  @Override
  @Transactional(readOnly = true)
  public PriceList require(UUID orgId, UUID priceListId) {
    return priceListRepository
        .findByIdAndOrgId(priceListId, orgId)
        .orElseThrow(
            () -> new NotFoundException("PRICE_LIST_NOT_FOUND", "Price list not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<PriceList> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return priceListRepository.findAllByOrgIdAndActiveTrue(orgId, pageable);
  }

  @Override
  @Transactional
  public PriceList update(
      UUID orgId,
      UUID priceListId,
      UUID branchId,
      String channel,
      String name,
      int priority,
      boolean active) {
    PriceList list = require(orgId, priceListId);
    list.setBranch(branchId != null ? branchService.require(orgId, branchId) : null);
    list.setChannel(channel);
    list.setName(name);
    list.setPriority(priority);
    list.setActive(active);
    list.setUpdatedAt(Instant.now(clock));
    return priceListRepository.save(list);
  }

  @Override
  @Transactional
  public void delete(UUID orgId, UUID priceListId) {
    PriceList list = require(orgId, priceListId);
    list.setActive(false);
    list.setUpdatedAt(Instant.now(clock));
    priceListRepository.save(list);
  }
}
