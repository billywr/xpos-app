package com.blinc.xpos.modules.catalog.repository;

import com.blinc.xpos.modules.catalog.domain.ModifierGroup;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ModifierGroupRepository extends JpaRepository<ModifierGroup, UUID> {

  @Query(
      """
      select g from ModifierGroup g
      where g.id = :id and g.org.id = :orgId
      """)
  Optional<ModifierGroup> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select g from ModifierGroup g
      where g.org.id = :orgId
      """)
  Page<ModifierGroup> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);
}
