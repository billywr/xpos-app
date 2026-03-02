package com.blinc.xpos.modules.catalog.repository;

import com.blinc.xpos.modules.catalog.domain.Item;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ItemRepository extends JpaRepository<Item, UUID> {

  @Query(
      """
      select i from Item i
      where i.id = :id and i.org.id = :orgId
      """)
  Optional<Item> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select i from Item i
      where i.org.id = :orgId
      """)
  Page<Item> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);

  @Query(
      """
      select i from Item i
      where i.org.id = :orgId and i.active = true
      """)
  Page<Item> findAllByOrgIdAndActiveTrue(@Param("orgId") UUID orgId, Pageable pageable);

  @Query(
      """
      select count(i) from Item i
      where i.org.id = :orgId and i.category.id = :categoryId
      """)
  long countByOrgIdAndCategoryId(@Param("orgId") UUID orgId, @Param("categoryId") UUID categoryId);

  @Query(
      """
      select count(i) from Item i
      where i.org.id = :orgId and i.baseUom.id = :uomId
      """)
  long countByOrgIdAndBaseUomId(@Param("orgId") UUID orgId, @Param("uomId") UUID uomId);
}
