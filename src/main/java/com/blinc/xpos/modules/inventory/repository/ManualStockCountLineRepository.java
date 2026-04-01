package com.blinc.xpos.modules.inventory.repository;

import com.blinc.xpos.modules.inventory.domain.ManualStockCountLine;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ManualStockCountLineRepository extends JpaRepository<ManualStockCountLine, UUID> {

  @Query(
      """
      select l from ManualStockCountLine l
      join l.sheet s
      where s.branch.id = :branchId
        and s.businessDate = :prevDate
        and l.item.id = :itemId
      order by l.lineOrder asc, l.id asc
      """)
  List<ManualStockCountLine> findByBranchPreviousDateAndItemId(
      @Param("branchId") UUID branchId,
      @Param("prevDate") LocalDate prevDate,
      @Param("itemId") UUID itemId);

  @Query(
      """
      select l from ManualStockCountLine l
      join l.sheet s
      where s.branch.id = :branchId
        and s.businessDate = :prevDate
        and l.item is null
        and lower(trim(l.itemName)) = lower(trim(:itemName))
      order by l.lineOrder asc, l.id asc
      """)
  List<ManualStockCountLine> findByBranchPreviousDateAndItemNameNormalized(
      @Param("branchId") UUID branchId,
      @Param("prevDate") LocalDate prevDate,
      @Param("itemName") String itemName);
}
