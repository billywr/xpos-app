package com.blinc.xpos.modules.inventory.repository;

import com.blinc.xpos.modules.inventory.domain.GoodsReceiptNote;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GoodsReceiptNoteRepository extends JpaRepository<GoodsReceiptNote, UUID> {

  @Query(
      """
      select g from GoodsReceiptNote g
      where g.id = :id and g.org.id = :orgId
      """)
  Optional<GoodsReceiptNote> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select g from GoodsReceiptNote g
      join fetch g.org
      join fetch g.branch
      join fetch g.supplier
      join fetch g.receivedBy
      left join fetch g.purchaseOrder
      where g.id = :id and g.org.id = :orgId
      """)
  Optional<GoodsReceiptNote> findByIdAndOrgIdWithAssociations(
      @Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      value =
          """
      select distinct g from GoodsReceiptNote g
      join fetch g.org
      join fetch g.branch
      join fetch g.supplier
      join fetch g.receivedBy
      left join fetch g.purchaseOrder
      where g.org.id = :orgId and g.branch.id = :branchId and g.active = true
      """,
      countQuery =
          """
      select count(g) from GoodsReceiptNote g
      where g.org.id = :orgId and g.branch.id = :branchId and g.active = true
      """)
  Page<GoodsReceiptNote> findAllByOrgIdAndBranchIdAndActiveTrue(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId, Pageable pageable);

  @Query(
      value =
          """
      select distinct g from GoodsReceiptNote g
      join fetch g.org
      join fetch g.branch
      join fetch g.supplier
      join fetch g.receivedBy
      left join fetch g.purchaseOrder
      where g.org.id = :orgId and g.branch.id = :branchId
      """,
      countQuery =
          """
      select count(g) from GoodsReceiptNote g
      where g.org.id = :orgId and g.branch.id = :branchId
      """)
  Page<GoodsReceiptNote> findAllByOrgIdAndBranchId(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId, Pageable pageable);

  /**
   * Latest active GRN for branch+supplier on the same calendar day (see service for zone used),
   * excluding purchase-order-linked receipts (those are not merged).
   */
  @Query(
      """
      select g from GoodsReceiptNote g
      where g.org.id = :orgId and g.branch.id = :branchId and g.supplier.id = :supplierId
      and g.active = true and g.purchaseOrder is null
      and g.receivedAt >= :dayStart and g.receivedAt < :dayEndExclusive
      order by g.receivedAt desc
      """)
  List<GoodsReceiptNote> findActiveWithoutPoForMergeSameDay(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("supplierId") UUID supplierId,
      @Param("dayStart") Instant dayStart,
      @Param("dayEndExclusive") Instant dayEndExclusive,
      Pageable pageable);
}
