package com.blinc.xpos.modules.organization.repository;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.modules.organization.domain.Business;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BusinessRepository extends JpaRepository<Business, UUID> {

  @Query(
      """
select b
            from Business b
            where b.id = :id
              and b.org.id = :orgId
            """)
  Optional<Business> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query("""
      select b from Business b
      where b.org.id = :orgId and b.status in :statuses
      """)
  Page<Business> findAllByOrgIdAndStatusIn(
      @Param("orgId") UUID orgId,
      @Param("statuses") Collection<StatusCommon> statuses,
      Pageable pageable);

  @Query(
      """
      select count(b) > 0 from Business b
      where b.kraPin is not null and b.kraPin = :kraPin
      """)
  boolean existsByKraPin(@Param("kraPin") String kraPin);

  @Query(
      """
      select count(b) > 0 from Business b
      where b.kraPin is not null and b.kraPin = :kraPin and b.id <> :excludeId
      """)
  boolean existsByKraPinAndIdNot(@Param("kraPin") String kraPin, @Param("excludeId") UUID excludeId);
}
