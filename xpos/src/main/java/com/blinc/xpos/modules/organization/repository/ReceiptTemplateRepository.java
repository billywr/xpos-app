package com.blinc.xpos.modules.organization.repository;

import com.blinc.xpos.modules.organization.domain.ReceiptTemplate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReceiptTemplateRepository extends JpaRepository<ReceiptTemplate, UUID> {

  @Query(
      """
      select r from ReceiptTemplate r
      where r.id = :id and r.org.id = :orgId
      """)
  Optional<ReceiptTemplate> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select r from ReceiptTemplate r
      where r.org.id = :orgId
      order by r.name
      """)
  Page<ReceiptTemplate> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);
}
