package com.blinc.xpos.modules.pricing.repository;

import com.blinc.xpos.modules.pricing.domain.PriceListItem;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PriceListItemRepository extends JpaRepository<PriceListItem, UUID> {

  @Query(
      """
      select i from PriceListItem i
      left join fetch i.item
      where i.id = :id and i.org.id = :orgId
      """)
  Optional<PriceListItem> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select i from PriceListItem i
      left join fetch i.item
      where i.priceList.id = :priceListId and i.org.id = :orgId
      order by i.item.name, i.createdAt
      """)
  List<PriceListItem> findAllByPriceListIdAndOrgId(
      @Param("priceListId") UUID priceListId, @Param("orgId") UUID orgId);

  @Query(
      """
      select i from PriceListItem i
      left join fetch i.item
      where i.priceList.id = :priceListId and i.org.id = :orgId
      order by i.item.name, i.createdAt
      """)
  Page<PriceListItem> findByPriceListIdAndOrgId(
      @Param("priceListId") UUID priceListId,
      @Param("orgId") UUID orgId,
      Pageable pageable);

  /**
   * Admin price list lines: service-like items (no physical stock expectation) stay listed; STOCK,
   * MENU, and tracked items only if on-hand is positive in scope.
   */
  @Query(
      """
      select pli from PriceListItem pli
      join fetch pli.item it
      join fetch pli.priceList pl
      left join fetch pl.branch
      where pli.priceList.id = :priceListId and pli.org.id = :orgId
      and (
        it.itemType <> com.blinc.xpos.common.constants.enums.ItemType.STOCK
          and it.itemType <> com.blinc.xpos.common.constants.enums.ItemType.MENU
          and it.trackInventory = false
        or (
          pl.branch is not null
          and exists (
            select 1 from InventoryItem inv
            where inv.org.id = :orgId
              and inv.branch.id = pl.branch.id
              and inv.item.id = it.id
              and inv.onHandQty > 0
          )
        )
        or (
          pl.branch is null
          and exists (
            select 1 from InventoryItem inv
            where inv.org.id = :orgId
              and inv.item.id = it.id
              and inv.onHandQty > 0
          )
        )
      )
      order by it.name asc, pli.createdAt asc
      """)
  List<PriceListItem> findAllByPriceListIdAndOrgIdInStockForAdmin(
      @Param("priceListId") UUID priceListId, @Param("orgId") UUID orgId);

  @Query(
      value =
          """
          select pli from PriceListItem pli
          join fetch pli.item it
          join fetch pli.priceList pl
          left join fetch pl.branch
          where pli.priceList.id = :priceListId and pli.org.id = :orgId
          and (
            it.itemType <> com.blinc.xpos.common.constants.enums.ItemType.STOCK
              and it.itemType <> com.blinc.xpos.common.constants.enums.ItemType.MENU
              and it.trackInventory = false
            or (
              pl.branch is not null
              and exists (
                select 1 from InventoryItem inv
                where inv.org.id = :orgId
                  and inv.branch.id = pl.branch.id
                  and inv.item.id = it.id
                  and inv.onHandQty > 0
              )
            )
            or (
              pl.branch is null
              and exists (
                select 1 from InventoryItem inv
                where inv.org.id = :orgId
                  and inv.item.id = it.id
                  and inv.onHandQty > 0
              )
            )
          )
          order by it.name asc, pli.createdAt asc
          """,
      countQuery =
          """
          select count(pli) from PriceListItem pli
          join pli.item it
          join pli.priceList pl
          where pli.priceList.id = :priceListId and pli.org.id = :orgId
          and (
            it.itemType <> com.blinc.xpos.common.constants.enums.ItemType.STOCK
              and it.itemType <> com.blinc.xpos.common.constants.enums.ItemType.MENU
              and it.trackInventory = false
            or (
              pl.branch is not null
              and exists (
                select 1 from InventoryItem inv
                where inv.org.id = :orgId
                  and inv.branch.id = pl.branch.id
                  and inv.item.id = it.id
                  and inv.onHandQty > 0
              )
            )
            or (
              pl.branch is null
              and exists (
                select 1 from InventoryItem inv
                where inv.org.id = :orgId
                  and inv.item.id = it.id
                  and inv.onHandQty > 0
              )
            )
          )
          """)
  Page<PriceListItem> findByPriceListIdAndOrgIdInStockForAdmin(
      @Param("priceListId") UUID priceListId,
      @Param("orgId") UUID orgId,
      Pageable pageable);


  @Query(
      """
      select i from PriceListItem i
      where i.priceList.id = :priceListId and i.item.id = :itemId and i.org.id = :orgId
      """)
  Optional<PriceListItem> findByPriceListIdAndItemIdAndOrgId(
      @Param("priceListId") UUID priceListId,
      @Param("itemId") UUID itemId,
      @Param("orgId") UUID orgId);

  @Query(
      """
      select distinct i.item.id from PriceListItem i
      where i.org.id = :orgId
      """)
  List<UUID> findDistinctItemIdsByOrgId(@Param("orgId") UUID orgId);

  @Query(
      """
      select i from PriceListItem i
      where i.org.id = :orgId and i.item.id = :itemId
      """)
  List<PriceListItem> findAllByOrgIdAndItemId(
      @Param("orgId") UUID orgId, @Param("itemId") UUID itemId);

  @Query(
      """
      select i from PriceListItem i
      join fetch i.priceList pl
      left join fetch pl.branch
      join fetch i.item it
      where i.org.id = :orgId and it.id = :itemId
      """)
  List<PriceListItem> findAllByOrgIdAndItemIdWithPriceListAndItem(
      @Param("orgId") UUID orgId, @Param("itemId") UUID itemId);
}
