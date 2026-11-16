package com.blinc.xpos.modules.catalog.repository;

import com.blinc.xpos.modules.catalog.domain.ItemImage;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ItemImageRepository extends JpaRepository<ItemImage, UUID> {

  @Query(
      """
      select img from ItemImage img
      where img.id = :id and img.org.id = :orgId
      """)
  Optional<ItemImage> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select img from ItemImage img
      where img.item.id = :itemId and img.org.id = :orgId
      order by img.sortOrder, img.createdAt
      """)
  List<ItemImage> findAllByItemIdAndOrgId(@Param("itemId") UUID itemId, @Param("orgId") UUID orgId);

  @Query(
      """
      select img from ItemImage img
      where img.org.id = :orgId and img.item.id in :itemIds
      and img.isPrimary = true
      """)
  List<ItemImage> findPrimaryByOrgIdAndItemIdIn(
      @Param("orgId") UUID orgId, @Param("itemIds") List<UUID> itemIds);
}
