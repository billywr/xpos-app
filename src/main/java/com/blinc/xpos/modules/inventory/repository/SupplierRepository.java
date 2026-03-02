package com.blinc.xpos.modules.inventory.repository;

import com.blinc.xpos.modules.inventory.domain.Supplier;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SupplierRepository extends JpaRepository<Supplier, UUID> {

  @Query(
      """
      select s from Supplier s
      where s.id = :id and s.org.id = :orgId
      """)
  Optional<Supplier> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select s from Supplier s
      where s.org.id = :orgId
      """)
  Page<Supplier> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);

  @Query(
      """
      select s from Supplier s
      where s.org.id = :orgId and s.active = true
      """)
  Page<Supplier> findAllByOrgIdAndActiveTrue(
      @Param("orgId") UUID orgId, Pageable pageable);
}
