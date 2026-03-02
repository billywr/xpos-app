package com.blinc.xpos.modules.pricing.service;

import com.blinc.xpos.modules.pricing.domain.PriceSchedule;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface PriceScheduleService {

  PriceSchedule create(
      UUID orgId,
      UUID branchId,
      String name,
      String startsAt,
      String endsAt,
      int daysOfWeek);

  PriceSchedule require(UUID orgId, UUID priceScheduleId);

  Page<PriceSchedule> list(UUID orgId, Pageable pageable);

  PriceSchedule update(
      UUID orgId,
      UUID priceScheduleId,
      UUID branchId,
      String name,
      String startsAt,
      String endsAt,
      int daysOfWeek);
}
