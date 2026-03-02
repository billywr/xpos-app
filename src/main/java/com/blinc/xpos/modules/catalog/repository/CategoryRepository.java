package com.blinc.xpos.modules.catalog.repository;

import com.blinc.xpos.modules.catalog.domain.Category;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CategoryRepository extends JpaRepository<Category, UUID> {

  @Query(
      """
      select c from Category c
      where c.id = :id and c.org.id = :orgId
      """)
  Optional<Category> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select c from Category c
      where c.org.id = :orgId
      """)
  Page<Category> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);

  @Query(
      """
      select count(c) from Category c
      where c.org.id = :orgId and c.parent.id = :parentId
      """)
  long countByOrgIdAndParentId(@Param("orgId") UUID orgId, @Param("parentId") UUID parentId);
}
