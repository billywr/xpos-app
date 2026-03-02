package com.blinc.xpos.modules.inventory.repository;

import com.blinc.xpos.modules.inventory.domain.PurchaseOrder;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, UUID> {

  @Query(
      """
      select p from PurchaseOrder p
      where p.id = :id and p.org.id = :orgId
      """)
  Optional<PurchaseOrder> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select p from PurchaseOrder p
      where p.org.id = :orgId and p.branch.id = :branchId
      """)
  Page<PurchaseOrder> findAllByOrgIdAndBranchId(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId, Pageable pageable);
}
