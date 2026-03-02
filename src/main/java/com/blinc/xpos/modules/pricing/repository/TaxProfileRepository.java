package com.blinc.xpos.modules.pricing.repository;

import com.blinc.xpos.modules.pricing.domain.TaxProfile;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaxProfileRepository extends JpaRepository<TaxProfile, UUID> {

  @Query(
      """
      select t from TaxProfile t
      where t.id = :id and t.org.id = :orgId
      """)
  Optional<TaxProfile> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select t from TaxProfile t
      where t.org.id = :orgId
      """)
  Page<TaxProfile> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);
}
