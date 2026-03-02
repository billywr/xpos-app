package com.blinc.xpos.modules.inventory.repository;

import com.blinc.xpos.modules.inventory.domain.PurchaseOrderLine;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PurchaseOrderLineRepository extends JpaRepository<PurchaseOrderLine, UUID> {

  @Query(
      """
      select l from PurchaseOrderLine l
      where l.purchaseOrder.id = :purchaseOrderId
      order by l.createdAt
      """)
  List<PurchaseOrderLine> findByPurchaseOrderIdOrderByCreatedAt(
      @Param("purchaseOrderId") UUID purchaseOrderId);
}
