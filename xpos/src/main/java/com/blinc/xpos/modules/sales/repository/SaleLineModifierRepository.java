package com.blinc.xpos.modules.sales.repository;

import com.blinc.xpos.modules.sales.domain.SaleLineModifier;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SaleLineModifierRepository extends JpaRepository<SaleLineModifier, UUID> {

  @Query(
      """
      select m from SaleLineModifier m
      where m.saleLine.id = :saleLineId
      order by m.createdAt
      """)
  List<SaleLineModifier> findBySaleLineIdOrderByCreatedAt(@Param("saleLineId") UUID saleLineId);

  @Query(
      """
      select m from SaleLineModifier m
      join fetch m.modifierOption
      where m.saleLine.id = :saleLineId
      order by m.createdAt
      """)
  List<SaleLineModifier> findBySaleLineIdOrderByCreatedAtWithModifierOption(
      @Param("saleLineId") UUID saleLineId);
}
