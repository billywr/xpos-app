package com.blinc.xpos.modules.pricing.service;

import com.blinc.xpos.modules.pricing.domain.ScheduledPrice;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public interface ScheduledPriceService {

  ScheduledPrice add(
      UUID orgId, UUID priceScheduleId, UUID itemId, BigDecimal price, String currency);

  ScheduledPrice requireInSchedule(UUID orgId, UUID priceScheduleId, UUID scheduledPriceId);

  List<ScheduledPrice> listBySchedule(UUID orgId, UUID priceScheduleId);

  void remove(UUID orgId, UUID priceScheduleId, UUID scheduledPriceId);

  /**
   * Deletes every scheduled price row linked to the item (hidden / soft-deleted catalog item).
   */
  void removeAllScheduledPricesForItem(UUID orgId, UUID itemId);
}
