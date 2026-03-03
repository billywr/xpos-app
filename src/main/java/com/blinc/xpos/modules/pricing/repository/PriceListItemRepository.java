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
}
