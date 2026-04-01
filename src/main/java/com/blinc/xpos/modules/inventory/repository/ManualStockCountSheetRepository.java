package com.blinc.xpos.modules.inventory.repository;

import com.blinc.xpos.modules.inventory.domain.ManualStockCountSheet;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ManualStockCountSheetRepository extends JpaRepository<ManualStockCountSheet, UUID> {

  @Query(
      """
      select distinct s from ManualStockCountSheet s
      left join fetch s.lines
      where s.branch.id = :branchId and s.businessDate = :businessDate
      """)
  Optional<ManualStockCountSheet> findByBranchIdAndBusinessDateFetchLines(
      @Param("branchId") UUID branchId, @Param("businessDate") LocalDate businessDate);
}
