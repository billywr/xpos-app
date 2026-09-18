package com.blinc.xpos.modules.inventory.repository;

import com.blinc.xpos.modules.inventory.domain.StdStockCountSnapshot;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StdStockCountSnapshotRepository
    extends JpaRepository<StdStockCountSnapshot, UUID> {

  @Query(
      """
      select s from StdStockCountSnapshot s
      where s.branch.id = :branchId and s.item.id = :itemId and s.businessDate = :businessDate
      """)
  Optional<StdStockCountSnapshot> findByBranchIdAndItemIdAndBusinessDate(
      @Param("branchId") UUID branchId,
      @Param("itemId") UUID itemId,
      @Param("businessDate") LocalDate businessDate);

  @Query(
      """
      select s from StdStockCountSnapshot s
      left join fetch s.item
      where s.branch.id = :branchId and s.businessDate = :businessDate
      """)
  List<StdStockCountSnapshot> findAllByBranchIdAndBusinessDate(
      @Param("branchId") UUID branchId, @Param("businessDate") LocalDate businessDate);

  @Query(
      """
      select s from StdStockCountSnapshot s
      where s.branch.id = :branchId and s.item.id = :itemId and s.businessDate = :businessDate
      """)
  Optional<StdStockCountSnapshot> findByBranchAndItemAndDate(
      @Param("branchId") UUID branchId,
      @Param("itemId") UUID itemId,
      @Param("businessDate") LocalDate businessDate);

  @Query(
      """
      select s from StdStockCountSnapshot s
      left join fetch s.item
      where s.branch.id = :branchId and s.businessDate = :businessDate and s.item.id in :itemIds
      """)
  List<StdStockCountSnapshot> findAllByBranchIdAndBusinessDateAndItemIdIn(
      @Param("branchId") UUID branchId,
      @Param("businessDate") LocalDate businessDate,
      @Param("itemIds") Collection<UUID> itemIds);

  @Query(
      """
      select s from StdStockCountSnapshot s
      left join fetch s.item
      where s.branch.id = :branchId and s.businessDate < :businessDate
      order by s.businessDate desc
      """)
  List<StdStockCountSnapshot> findAllByBranchIdAndBusinessDateBefore(
      @Param("branchId") UUID branchId, @Param("businessDate") LocalDate businessDate);

  @Query(
      """
      select max(s.businessDate) from StdStockCountSnapshot s
      where s.branch.id = :branchId
      """)
  Optional<LocalDate> findMaxBusinessDateByBranchId(@Param("branchId") UUID branchId);

  @Query(
      """
      select distinct s.org.id as orgId, s.branch.id as branchId
      from StdStockCountSnapshot s
      join s.branch b
      where b.status = com.blinc.xpos.common.constants.enums.StatusCommon.ACTIVE
      """)
  List<BranchSnapshotTarget> findDistinctActiveBranchesWithSnapshots();
}
