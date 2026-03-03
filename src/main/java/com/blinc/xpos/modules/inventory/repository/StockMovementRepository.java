package com.blinc.xpos.modules.inventory.repository;

import com.blinc.xpos.modules.inventory.domain.StockMovement;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StockMovementRepository extends JpaRepository<StockMovement, UUID> {

  @Query(
      """
      select s from StockMovement s
      where s.id = :id and s.org.id = :orgId
      """)
  Optional<StockMovement> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select s from StockMovement s
      where s.org.id = :orgId and s.branch.id = :branchId
      """)
  Page<StockMovement> findAllByOrgIdAndBranchId(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId, Pageable pageable);

  @Query(
      """
      select s.item.id, sum(s.qty) from StockMovement s
      where s.org.id = :orgId and s.branch.id = :branchId
        and s.movementType = com.blinc.xpos.common.constants.enums.MovementType.OUT
        and s.sourceType = com.blinc.xpos.common.constants.enums.SourceType.SALE
      group by s.item.id
      """)
  List<Object[]> sumSoldQtyByItemIdForBranch(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId);

  @Query(
      """
      select s.item.id, sum(s.qty) from StockMovement s
      where s.org.id = :orgId and s.branch.id = :branchId
        and s.movementType = com.blinc.xpos.common.constants.enums.MovementType.OUT
        and s.sourceType = com.blinc.xpos.common.constants.enums.SourceType.SALE
        and s.createdAt >= :since
      group by s.item.id
      """)
  List<Object[]> sumSoldQtyByItemIdForBranchSince(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("since") java.time.Instant since);

  @Query(
      """
      select s.item.id, sum(s.qty) from StockMovement s
      where s.org.id = :orgId and s.branch.id = :branchId
        and s.movementType = com.blinc.xpos.common.constants.enums.MovementType.IN
        and s.sourceType = com.blinc.xpos.common.constants.enums.SourceType.GRN
      group by s.item.id
      """)
  List<Object[]> sumReceivedQtyByItemIdForBranch(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId);

  @Query(
      """
      select max(s.unitCost) from StockMovement s
      where s.org.id = :orgId and s.item.id = :itemId
        and s.movementType = com.blinc.xpos.common.constants.enums.MovementType.IN
        and s.unitCost is not null
      """)
  java.math.BigDecimal findMaxUnitCostByOrgAndItem(
      @Param("orgId") UUID orgId, @Param("itemId") UUID itemId);

  @Query(
      """
      select distinct s.item.id from StockMovement s
      where s.org.id = :orgId
        and s.movementType = com.blinc.xpos.common.constants.enums.MovementType.IN
        and s.unitCost is not null
      """)
  java.util.List<UUID> findItemIdsWithPurchaseHistoryByOrgId(@Param("orgId") UUID orgId);

  @Query(
      """
      select s from StockMovement s
      where s.org.id = :orgId and s.branch.id = :branchId and s.item.id = :itemId
        and s.movementType = com.blinc.xpos.common.constants.enums.MovementType.IN
        and s.unitCost is not null
      order by s.createdAt desc
      """)
  org.springframework.data.domain.Page<StockMovement> findLatestInByOrgAndBranchAndItem(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("itemId") UUID itemId,
      org.springframework.data.domain.Pageable pageable);

  @Query(
      """
      select s from StockMovement s
      where s.org.id = :orgId and s.branch.id = :branchId
        and s.movementType = com.blinc.xpos.common.constants.enums.MovementType.OUT
        and s.sourceType = com.blinc.xpos.common.constants.enums.SourceType.SALE
        and s.createdAt >= :start and s.createdAt < :end
      order by s.createdAt
      """)
  java.util.List<StockMovement> findSaleOutByBranchAndDateRange(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("start") java.time.Instant start,
      @Param("end") java.time.Instant end);
}
