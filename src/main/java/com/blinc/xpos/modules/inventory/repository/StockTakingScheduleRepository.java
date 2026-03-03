package com.blinc.xpos.modules.inventory.repository;

import com.blinc.xpos.modules.inventory.domain.StockTakingSchedule;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StockTakingScheduleRepository extends JpaRepository<StockTakingSchedule, UUID> {

  @Query(
      """
      select s from StockTakingSchedule s
      where s.id = :id and s.org.id = :orgId
      """)
  Optional<StockTakingSchedule> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select s from StockTakingSchedule s
      where s.org.id = :orgId and s.branch.id = :branchId
      """)
  Optional<StockTakingSchedule> findByOrgIdAndBranchId(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId);

  @Query(
      """
      select s from StockTakingSchedule s
      where s.isActive = true
      """)
  List<StockTakingSchedule> findAllActive();

  @Query(
      """
      select s from StockTakingSchedule s
      where s.org.id = :orgId
      """)
  Page<StockTakingSchedule> findAllByOrgId(
      @Param("orgId") UUID orgId, Pageable pageable);

  @Modifying
  @Query(
      """
      update StockTakingSchedule s
      set s.lastRunAt = :lastRunAt
      where s.id = :id
      """)
  void updateLastRunAt(@Param("id") UUID id, @Param("lastRunAt") java.time.Instant lastRunAt);
}
