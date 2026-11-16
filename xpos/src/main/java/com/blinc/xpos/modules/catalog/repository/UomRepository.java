package com.blinc.xpos.modules.catalog.repository;

import com.blinc.xpos.modules.catalog.domain.Uom;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UomRepository extends JpaRepository<Uom, UUID> {

  @Query("""
      select u from Uom u
      where u.id = :id and u.org.id = :orgId
      """)
  Optional<Uom> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query("""
      select u from Uom u
      where u.org.id = :orgId
      """)
  Page<Uom> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);
}
