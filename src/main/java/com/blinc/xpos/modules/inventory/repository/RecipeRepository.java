package com.blinc.xpos.modules.inventory.repository;

import com.blinc.xpos.modules.inventory.domain.Recipe;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RecipeRepository extends JpaRepository<Recipe, UUID> {

  @Query(
      """
      select r from Recipe r
      left join fetch r.org left join fetch r.menuItem
      where r.id = :id and r.org.id = :orgId
      """)
  Optional<Recipe> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select r from Recipe r
      left join fetch r.org left join fetch r.menuItem
      where r.org.id = :orgId
      """)
  Page<Recipe> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);

  @Query(
      """
      select r from Recipe r
      where r.org.id = :orgId and r.menuItem.id = :menuItemId
      """)
  Optional<Recipe> findByOrgIdAndMenuItemId(
      @Param("orgId") UUID orgId, @Param("menuItemId") UUID menuItemId);
}
