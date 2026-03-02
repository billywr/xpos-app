package com.blinc.xpos.modules.inventory.repository;

import com.blinc.xpos.modules.inventory.domain.InventoryItem;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, UUID> {

  @Query(
      """
      select i from InventoryItem i
      where i.org.id = :orgId and i.branch.id = :branchId and i.item.id = :itemId
      """)
  Optional<InventoryItem> findByOrgIdAndBranchIdAndItemId(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("itemId") UUID itemId);

  @Query(
      """
      select i from InventoryItem i
      join fetch i.item
      where i.org.id = :orgId and i.branch.id = :branchId
      """)
  Page<InventoryItem> findAllByOrgIdAndBranchIdWithItem(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      Pageable pageable);
}
