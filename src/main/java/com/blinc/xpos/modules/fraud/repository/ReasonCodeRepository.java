package com.blinc.xpos.modules.fraud.repository;

import com.blinc.xpos.modules.fraud.domain.ReasonCode;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReasonCodeRepository extends JpaRepository<ReasonCode, UUID> {

  @Query(
      """
      select r from ReasonCode r
      where r.id = :id and r.org.id = :orgId
      """)
  Optional<ReasonCode> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select r from ReasonCode r
      where r.org.id = :orgId
      order by r.code
      """)
  Page<ReasonCode> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);
}
