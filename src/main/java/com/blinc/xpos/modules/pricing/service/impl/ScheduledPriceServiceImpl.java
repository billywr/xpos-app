package com.blinc.xpos.modules.pricing.service.impl;

import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.service.ItemService;
import com.blinc.xpos.modules.inventory.repository.StockMovementRepository;
import com.blinc.xpos.modules.pricing.domain.PriceSchedule;
import com.blinc.xpos.modules.pricing.domain.ScheduledPrice;
import com.blinc.xpos.modules.pricing.repository.ScheduledPriceRepository;
import com.blinc.xpos.modules.pricing.service.PriceScheduleService;
import com.blinc.xpos.modules.pricing.service.ScheduledPriceService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ScheduledPriceServiceImpl implements ScheduledPriceService {

  private static final String DEFAULT_CURRENCY = "KES";

  private final ScheduledPriceRepository scheduledPriceRepository;
  private final PriceScheduleService priceScheduleService;
  private final ItemService itemService;
  private final StockMovementRepository stockMovementRepository;
  private final Clock clock;

  public ScheduledPriceServiceImpl(
      ScheduledPriceRepository scheduledPriceRepository,
      PriceScheduleService priceScheduleService,
      ItemService itemService,
      StockMovementRepository stockMovementRepository,
      Clock clock) {
    this.scheduledPriceRepository =
        Objects.requireNonNull(scheduledPriceRepository, "scheduledPriceRepository");
    this.priceScheduleService =
        Objects.requireNonNull(priceScheduleService, "priceScheduleService");
    this.itemService = Objects.requireNonNull(itemService, "itemService");
    this.stockMovementRepository =
        Objects.requireNonNull(stockMovementRepository, "stockMovementRepository");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public ScheduledPrice add(
      UUID orgId, UUID priceScheduleId, UUID itemId, BigDecimal price, String currency) {
    PriceSchedule schedule = priceScheduleService.require(orgId, priceScheduleId);
    Item item = itemService.requireActive(orgId, itemId);

    BigDecimal sellingPrice = price != null ? price : BigDecimal.ZERO;
    BigDecimal maxFromMovements =
        stockMovementRepository.findMaxUnitCostByOrgAndItem(orgId, itemId);
    BigDecimal buying = item.getBuyingPrice();
    BigDecimal floorUnitCost;
    if (maxFromMovements == null) {
      floorUnitCost = buying;
    } else if (buying != null && buying.compareTo(maxFromMovements) > 0) {
      floorUnitCost = buying;
    } else {
      floorUnitCost = maxFromMovements;
    }

    if (floorUnitCost == null) {
      throw new BadRequestException(
          "ITEM_NOT_SUPPLIED",
          "Item has no purchase history. You cannot sell what you don't have. "
              + "Go to Inventory → Stock, receive stock when stock arrives, "
              + "record the unit cost, then add the item to this schedule.");
    }

    if (sellingPrice.compareTo(floorUnitCost) <= 0) {
      throw new BadRequestException(
          "SELLING_PRICE_BELOW_COST",
          "Selling price must be greater than buying price (cost: "
              + floorUnitCost
              + "). Reduce cost or increase selling price.");
    }

    ScheduledPrice scheduled = new ScheduledPrice();
    scheduled.setOrg(schedule.getOrg());
    scheduled.setPriceSchedule(schedule);
    scheduled.setItem(item);
    scheduled.setPrice(sellingPrice);
    scheduled.setCurrency(
        currency != null && !currency.isBlank() ? currency : DEFAULT_CURRENCY);
    scheduled.setCreatedAt(Instant.now(clock));
    return scheduledPriceRepository.save(scheduled);
  }

  @Override
  @Transactional(readOnly = true)
  public ScheduledPrice requireInSchedule(
      UUID orgId, UUID priceScheduleId, UUID scheduledPriceId) {
    ScheduledPrice scheduled =
        scheduledPriceRepository
            .findByIdAndOrgId(scheduledPriceId, orgId)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "SCHEDULED_PRICE_NOT_FOUND", "Scheduled price not found"));
    if (!scheduled.getPriceSchedule().getId().equals(priceScheduleId)) {
      throw new NotFoundException(
          "SCHEDULED_PRICE_NOT_FOUND", "Scheduled price not found in this schedule");
    }
    return scheduled;
  }

  @Override
  @Transactional(readOnly = true)
  public List<ScheduledPrice> listBySchedule(UUID orgId, UUID priceScheduleId) {
    priceScheduleService.require(orgId, priceScheduleId);
    return scheduledPriceRepository.findAllByPriceScheduleIdAndOrgId(
        priceScheduleId, orgId);
  }

  @Override
  @Transactional
  public void remove(UUID orgId, UUID priceScheduleId, UUID scheduledPriceId) {
    ScheduledPrice scheduled = requireInSchedule(orgId, priceScheduleId, scheduledPriceId);
    scheduledPriceRepository.delete(scheduled);
  }

  @Override
  @Transactional
  public void removeAllScheduledPricesForItem(UUID orgId, UUID itemId) {
    var rows = scheduledPriceRepository.findAllByOrgIdAndItemId(orgId, itemId);
    if (!rows.isEmpty()) {
      scheduledPriceRepository.deleteAll(rows);
    }
  }
}
