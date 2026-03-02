package com.blinc.xpos.modules.inventory.repository;

import com.blinc.xpos.modules.inventory.domain.GrnLine;
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
}
