package com.blinc.xpos.modules.inventory.repository;

import com.blinc.xpos.modules.inventory.domain.StockCountLine;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StockCountLineRepository extends JpaRepository<StockCountLine, UUID> {

  @Query(
      """
      select l from StockCountLine l
      join fetch l.item
      where l.session.id = :sessionId
      order by l.createdAt
      """)
  List<StockCountLine> findBySessionIdOrderByCreatedAt(@Param("sessionId") UUID sessionId);
}
