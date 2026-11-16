package com.blinc.xpos.modules.catalog.repository;

import com.blinc.xpos.modules.catalog.domain.ModifierOption;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ModifierOptionRepository extends JpaRepository<ModifierOption, UUID> {

  @Query(
      """
      select o from ModifierOption o
      where o.id = :id and o.org.id = :orgId
      """)
  Optional<ModifierOption> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select o from ModifierOption o
      where o.modifierGroup.id = :modifierGroupId and o.org.id = :orgId
      """)
  Page<ModifierOption> findAllByModifierGroupIdAndOrgId(
      @Param("modifierGroupId") UUID modifierGroupId,
      @Param("orgId") UUID orgId,
      Pageable pageable);
}
