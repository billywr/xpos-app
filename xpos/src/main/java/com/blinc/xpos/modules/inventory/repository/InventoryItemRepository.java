package com.blinc.xpos.modules.inventory.repository;

import com.blinc.xpos.modules.inventory.domain.InventoryItem;
import java.util.Collection;
import java.util.List;
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
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId, @Param("itemId") UUID itemId);

  @Query(
      """
      select i from InventoryItem i
      join fetch i.item
      where i.org.id = :orgId and i.branch.id = :branchId and i.item.id in :itemIds
      """)
  List<InventoryItem> findAllByOrgIdAndBranchIdAndItemIdIn(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("itemIds") Collection<UUID> itemIds);

  @Query(
      """
      select i from InventoryItem i
      join fetch i.item
      where i.org.id = :orgId and i.branch.id = :branchId
      """)
  List<InventoryItem> findAllByOrgIdAndBranchIdWithItem(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId);

  @Query(
      """
      select i from InventoryItem i
      join fetch i.item
      where i.org.id = :orgId and i.branch.id = :branchId
      """)
  Page<InventoryItem> findAllByOrgIdAndBranchIdWithItem(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId, Pageable pageable);

  @Query(
      """
      select count(inv) from InventoryItem inv
      where inv.org.id = :orgId and inv.item.id = :itemId and inv.onHandQty > 0
      """)
  long countWithPositiveOnHandByOrgAndItem(
      @Param("orgId") UUID orgId, @Param("itemId") UUID itemId);

  @Query(
      """
      select i from InventoryItem i
      join fetch i.item it
      where i.org.id = :orgId and i.branch.id = :branchId
        and it.active = true
        and i.reorderPoint is not null
        and i.onHandQty <= i.reorderPoint
      order by i.onHandQty asc, it.name asc
      """)
  List<InventoryItem> findLowStockByOrgAndBranch(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId, Pageable pageable);
}
