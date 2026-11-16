package com.blinc.xpos.modules.inventory.repository;

import com.blinc.xpos.modules.inventory.domain.TransferOrderLine;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TransferOrderLineRepository extends JpaRepository<TransferOrderLine, UUID> {

  @Query(
      """
      select l from TransferOrderLine l
      left join fetch l.item left join fetch l.uom
      where l.transferOrder.id = :transferOrderId
      order by l.createdAt
      """)
  List<TransferOrderLine> findByTransferOrderIdOrderByCreatedAt(
      @Param("transferOrderId") UUID transferOrderId);
}
