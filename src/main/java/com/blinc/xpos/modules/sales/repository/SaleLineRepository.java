package com.blinc.xpos.modules.sales.repository;

import com.blinc.xpos.modules.sales.domain.SaleLine;
import com.blinc.xpos.modules.sales.dto.TopItemProjection;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SaleLineRepository extends JpaRepository<SaleLine, UUID> {

  @Query(
      """
      select new com.blinc.xpos.modules.sales.dto.TopItemProjection(
        l.item.id, l.item.name, coalesce(sum(l.qty), 0), coalesce(sum(l.lineTotal), 0))
      from SaleLine l join l.sale s
      where s.org.id = :orgId and s.branch.id = :branchId and s.status = 'COMPLETED'
      and s.completedAt >= :start and s.completedAt < :end
      group by l.item.id, l.item.name
      order by sum(l.lineTotal) desc
      """)
  List<TopItemProjection> findTopItemsByBranchAndDateRange(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("start") Instant start,
      @Param("end") Instant end,
      Pageable pageable);

  @Query(
      """
      select l from SaleLine l
      where l.sale.id = :saleId
      order by l.createdAt
      """)
  List<SaleLine> findBySaleIdOrderByCreatedAt(@Param("saleId") UUID saleId);

  @Query(
      """
      select distinct l from SaleLine l
      join fetch l.item
      left join fetch l.uom
      where l.sale.id = :saleId
      order by l.createdAt
      """)
  List<SaleLine> findBySaleIdOrderByCreatedAtWithItemAndUom(@Param("saleId") UUID saleId);

  @Query(
      """
      select l.item.id, coalesce(sum(l.qty), 0)
      from SaleLine l join l.sale s
      where s.org.id = :orgId and s.branch.id = :branchId
      and s.status = 'COMPLETED' and s.businessDate = :businessDate
      group by l.item.id
      """)
  List<Object[]> sumQtyByItemForOrgBranchAndBusinessDate(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("businessDate") java.time.LocalDate businessDate);
}
