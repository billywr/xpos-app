package com.blinc.xpos.modules.sales.repository;

import com.blinc.xpos.modules.sales.domain.SaleTaxLine;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SaleTaxLineRepository extends JpaRepository<SaleTaxLine, UUID> {

  @Query(
      """
      select t from SaleTaxLine t
      left join fetch t.taxProfile
      where t.sale.id = :saleId
      order by t.createdAt
      """)
  List<SaleTaxLine> findBySaleIdOrderByCreatedAtWithTaxProfile(@Param("saleId") UUID saleId);
}
