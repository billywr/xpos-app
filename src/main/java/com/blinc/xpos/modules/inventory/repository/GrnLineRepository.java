package com.blinc.xpos.modules.inventory.repository;

import com.blinc.xpos.modules.inventory.domain.GrnLine;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GrnLineRepository extends JpaRepository<GrnLine, UUID> {

  @Query(
      """
      select l from GrnLine l
      join fetch l.item
      left join fetch l.uom
      where l.grn.id = :grnId
      order by l.createdAt
      """)
  List<GrnLine> findByGrnIdOrderByCreatedAt(@Param("grnId") UUID grnId);

  /**
   * Distinct unit costs for an item in the org on GRNs other than {@code excludeGrnId}.
   * When {@code excludeGrnId} is null, includes all GRNs.
   */
  @Query(
      """
      select distinct l.receivedUnitCost from GrnLine l
      join l.grn g
      join l.item i
      where g.org.id = :orgId and l.item.id = :itemId
      and i.active = true
      and g.active = true
      and (:excludeGrnId is null or g.id <> :excludeGrnId)
      """)
  List<BigDecimal> findDistinctReceivedUnitCostsByOrgAndItemExcludingGrn(
      @Param("orgId") UUID orgId,
      @Param("itemId") UUID itemId,
      @Param("excludeGrnId") UUID excludeGrnId);

  /**
   * Sum of current GRN line quantities per item for active receipts whose {@code receivedAt} falls in
   * the branch business day window (standard stock count "Added").
   */
  @Query(
      """
      select l.item.id, sum(l.qty) from GrnLine l
      join l.grn g
      where g.org.id = :orgId and g.branch.id = :branchId
        and g.active = true
        and g.receivedAt >= :dayStart and g.receivedAt < :dayEnd
      group by l.item.id
      """)
  List<Object[]> sumLineQtyByItemIdForBranchAndGrnReceivedAtRange(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("dayStart") Instant dayStart,
      @Param("dayEnd") Instant dayEnd);
}
