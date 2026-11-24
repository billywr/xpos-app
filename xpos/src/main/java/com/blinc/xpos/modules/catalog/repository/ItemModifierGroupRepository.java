package com.blinc.xpos.modules.catalog.repository;

import com.blinc.xpos.modules.catalog.domain.ItemModifierGroup;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ItemModifierGroupRepository extends JpaRepository<ItemModifierGroup, UUID> {

  @Query(
      """
      select m from ItemModifierGroup m
      where m.id = :id and m.org.id = :orgId
      """)
  Optional<ItemModifierGroup> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select m from ItemModifierGroup m
      where m.item.id = :itemId and m.org.id = :orgId
      order by m.createdAt
      """)
  List<ItemModifierGroup> findAllByItemIdAndOrgId(
      @Param("itemId") UUID itemId, @Param("orgId") UUID orgId);

  @Query(
      """
      select m from ItemModifierGroup m
      where m.org.id = :orgId
      order by m.createdAt
      """)
  List<ItemModifierGroup> findAllByOrgId(@Param("orgId") UUID orgId);
}
