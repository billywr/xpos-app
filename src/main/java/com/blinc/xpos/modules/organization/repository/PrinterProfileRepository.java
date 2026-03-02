package com.blinc.xpos.modules.organization.repository;

import com.blinc.xpos.modules.organization.domain.PrinterProfile;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PrinterProfileRepository extends JpaRepository<PrinterProfile, UUID> {

  @Query(
      """
      select p from PrinterProfile p
      where p.id = :id and p.org.id = :orgId
      """)
  Optional<PrinterProfile> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select p from PrinterProfile p
      where p.org.id = :orgId
      order by p.name
      """)
  Page<PrinterProfile> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);
}
