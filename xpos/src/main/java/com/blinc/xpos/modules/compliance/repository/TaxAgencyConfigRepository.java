package com.blinc.xpos.modules.compliance.repository;

import com.blinc.xpos.modules.compliance.domain.TaxAgencyConfig;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaxAgencyConfigRepository extends JpaRepository<TaxAgencyConfig, UUID> {

  @Query(
      """
      select t from TaxAgencyConfig t
      where t.id = :id and t.org.id = :orgId
      """)
  Optional<TaxAgencyConfig> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select t from TaxAgencyConfig t
      where t.org.id = :orgId
      order by t.name
      """)
  Page<TaxAgencyConfig> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);
}
