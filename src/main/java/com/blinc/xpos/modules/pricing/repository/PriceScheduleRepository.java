package com.blinc.xpos.modules.pricing.repository;

import com.blinc.xpos.modules.pricing.domain.PriceSchedule;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PriceScheduleRepository extends JpaRepository<PriceSchedule, UUID> {

  @Query(
      """
      select s from PriceSchedule s
      where s.id = :id and s.org.id = :orgId
      """)
  Optional<PriceSchedule> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select s from PriceSchedule s
      where s.org.id = :orgId
      """)
  Page<PriceSchedule> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);
}
