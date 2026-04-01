package com.blinc.xpos.modules.inventory.repository;

import com.blinc.xpos.common.constants.enums.SourceType;
import com.blinc.xpos.modules.inventory.domain.StockMovement;
import java.time.Instant;
import java.util.Collection;
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
      join fetch s.item
      where s.org.id = :orgId
        and s.sourceType = :sourceType
        and s.sourceId = :sourceId
      order by s.createdAt asc, s.id asc
      """)
  List<StockMovement> findAllByOrgIdAndSourceTypeAndSourceIdOrderByCreatedAtAsc(
      @Param("orgId") UUID orgId,
      @Param("sourceType") SourceType sourceType,
      @Param("sourceId") UUID sourceId);

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
        and exists (
          select 1 from GoodsReceiptNote g
          where g.id = s.sourceId and g.org.id = :orgId and g.active = true)
      group by s.item.id
      """)
  List<Object[]> sumReceivedQtyByItemIdForBranch(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId);

  @Query(
      """
      select max(s.unitCost) from StockMovement s
      where s.org.id = :orgId and s.item.id = :itemId
        and s.item.active = true
        and s.movementType = com.blinc.xpos.common.constants.enums.MovementType.IN
        and s.unitCost is not null
        and (
          s.sourceType <> com.blinc.xpos.common.constants.enums.SourceType.GRN
          or exists (
            select 1 from GoodsReceiptNote g
            where g.id = s.sourceId and g.org.id = :orgId and g.active = true))
      """)
  java.math.BigDecimal findMaxUnitCostByOrgAndItem(
      @Param("orgId") UUID orgId, @Param("itemId") UUID itemId);

  @Query(
      """
      select distinct s.item.id from StockMovement s
      where s.org.id = :orgId
        and s.item.active = true
        and s.movementType = com.blinc.xpos.common.constants.enums.MovementType.IN
        and s.unitCost is not null
        and (
          s.sourceType <> com.blinc.xpos.common.constants.enums.SourceType.GRN
          or exists (
            select 1 from GoodsReceiptNote g
            where g.id = s.sourceId and g.org.id = :orgId and g.active = true))
      """)
  java.util.List<UUID> findItemIdsWithPurchaseHistoryByOrgId(@Param("orgId") UUID orgId);

  @Query(
      """
      select s from StockMovement s
      where s.org.id = :orgId and s.branch.id = :branchId and s.item.id = :itemId
        and s.item.active = true
        and s.movementType = com.blinc.xpos.common.constants.enums.MovementType.IN
        and s.unitCost is not null
        and (
          s.sourceType <> com.blinc.xpos.common.constants.enums.SourceType.GRN
          or exists (
            select 1 from GoodsReceiptNote g
            where g.id = s.sourceId and g.org.id = :orgId and g.active = true))
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

  /**
   * Net on-hand from stock movements with {@code createdAt < asOfExclusive} (signed: IN/TRANSFER_IN
   * add; OUT/TRANSFER_OUT/WASTE/CONSUMPTION subtract; ADJUST uses signed qty). Used for std stock
   * count Opening (at start of day) and System (ledger at end of selected business day).
   */
  @Query(
      """
      select s.item.id,
        coalesce(sum(
          case
            when s.movementType = com.blinc.xpos.common.constants.enums.MovementType.IN
              or s.movementType = com.blinc.xpos.common.constants.enums.MovementType.TRANSFER_IN
              then s.qty
            when s.movementType = com.blinc.xpos.common.constants.enums.MovementType.OUT
              or s.movementType = com.blinc.xpos.common.constants.enums.MovementType.TRANSFER_OUT
              or s.movementType = com.blinc.xpos.common.constants.enums.MovementType.WASTE
              or s.movementType = com.blinc.xpos.common.constants.enums.MovementType.CONSUMPTION
              then -s.qty
            when s.movementType = com.blinc.xpos.common.constants.enums.MovementType.ADJUST
              then s.qty
            else 0
          end
        ), 0)
      from StockMovement s
      where s.org.id = :orgId and s.branch.id = :branchId
        and s.item.id in :itemIds
        and s.createdAt < :asOfExclusive
      group by s.item.id
      """)
  List<Object[]> sumNetQtyByItemForBranchUpToExclusive(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("itemIds") Collection<UUID> itemIds,
      @Param("asOfExclusive") Instant asOfExclusive);

  /**
   * Sum of positive stock-take adjustments per item for a branch within a date range. For std stock
   * count "Added today" (variance increases from counted stock / corrections, not GRN).
   */
  @Query(
      """
      select s.item.id, sum(case when s.qty > 0 then s.qty else 0 end) from StockMovement s
      where s.org.id = :orgId and s.branch.id = :branchId
        and s.movementType = com.blinc.xpos.common.constants.enums.MovementType.ADJUST
        and s.sourceType = com.blinc.xpos.common.constants.enums.SourceType.STOCKTAKE
        and s.createdAt >= :start and s.createdAt < :end
      group by s.item.id
      """)
  List<Object[]> sumStockTakePositiveAdjustQtyByItemIdForBranchAndDateRange(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("start") java.time.Instant start,
      @Param("end") java.time.Instant end);
}
