package com.blinc.xpos.modules.sales.repository;

import com.blinc.xpos.modules.sales.domain.Tender;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TenderRepository extends JpaRepository<Tender, UUID> {

  @Query(
      """
      select t from Tender t
      where t.sale.id = :saleId
      order by t.capturedAt
      """)
  List<Tender> findBySaleIdOrderByCapturedAt(@Param("saleId") UUID saleId);

  @Query(
      """
      select distinct t from Tender t
      join fetch t.tenderType
      join fetch t.capturedByStaffUser
      where t.sale.id = :saleId
      order by t.capturedAt
      """)
  List<Tender> findBySaleIdOrderByCapturedAtWithTenderTypeAndStaff(@Param("saleId") UUID saleId);

  @Query(
      """
      select t from Tender t
      where t.sale.id in :saleIds
      order by t.sale.id, t.capturedAt
      """)
  List<Tender> findBySaleIdIn(@Param("saleIds") List<UUID> saleIds);

  @Query(
      """
      select t from Tender t
      join fetch t.tenderType
      where t.sale.id in :saleIds
      order by t.sale.id, t.capturedAt
      """)
  List<Tender> findBySaleIdInWithTenderType(@Param("saleIds") List<UUID> saleIds);
}
