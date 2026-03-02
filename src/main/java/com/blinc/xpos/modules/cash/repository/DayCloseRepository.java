package com.blinc.xpos.modules.cash.repository;

import com.blinc.xpos.modules.cash.domain.DayClose;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DayCloseRepository extends JpaRepository<DayClose, UUID> {

  @Query(
      """
      select d from DayClose d
      where d.id = :id and d.org.id = :orgId
      """)
  Optional<DayClose> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select d from DayClose d
      where d.branch.id = :branchId and d.businessDate = :businessDate
      """)
  Optional<DayClose> findByBranchIdAndBusinessDate(
      @Param("branchId") UUID branchId, @Param("businessDate") LocalDate businessDate);

  @Query(
      """
      select d from DayClose d
      where d.branch.id = :branchId
      order by d.businessDate desc
      """)
  Page<DayClose> findAllByBranchId(
      @Param("branchId") UUID branchId, Pageable pageable);
}
