package com.blinc.xpos.modules.catalog.repository;

import com.blinc.xpos.modules.catalog.domain.ItemUom;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ItemUomRepository extends JpaRepository<ItemUom, UUID> {

  @Query("""
      select u from ItemUom u
      where u.id = :id and u.org.id = :orgId
      """)
  Optional<ItemUom> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select u from ItemUom u
      where u.item.id = :itemId and u.org.id = :orgId
      order by u.createdAt
      """)
  List<ItemUom> findAllByItemIdAndOrgId(@Param("itemId") UUID itemId, @Param("orgId") UUID orgId);

  @Query(
      """
      select count(u) from ItemUom u
      where u.org.id = :orgId and u.uom.id = :uomId
      """)
  long countByOrgIdAndUomId(@Param("orgId") UUID orgId, @Param("uomId") UUID uomId);
}
