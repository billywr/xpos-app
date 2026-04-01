package com.blinc.xpos.modules.pricing.repository;

import com.blinc.xpos.modules.pricing.domain.ScheduledPrice;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ScheduledPriceRepository extends JpaRepository<ScheduledPrice, UUID> {

  @Query(
      """
      select s from ScheduledPrice s
      where s.id = :id and s.org.id = :orgId
      """)
  Optional<ScheduledPrice> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select s from ScheduledPrice s
      where s.priceSchedule.id = :priceScheduleId and s.org.id = :orgId
      order by s.createdAt
      """)
  List<ScheduledPrice> findAllByPriceScheduleIdAndOrgId(
      @Param("priceScheduleId") UUID priceScheduleId, @Param("orgId") UUID orgId);

  @Query(
      """
      select s from ScheduledPrice s
      where s.org.id = :orgId and s.item.id = :itemId
      """)
  List<ScheduledPrice> findAllByOrgIdAndItemId(
      @Param("orgId") UUID orgId, @Param("itemId") UUID itemId);
}
