package com.blinc.xpos.modules.organization.repository;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.modules.organization.domain.Branch;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BranchRepository extends JpaRepository<Branch, UUID> {

  @Query(
      """
select b
            from Branch b
            where b.id = :id
              and b.org.id = :orgId
            """)
  Optional<Branch> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query("""
      select b from Branch b
      where b.org.id = :orgId and b.status in :statuses
      """)
  Page<Branch> findAllByOrgIdAndStatusIn(
      @Param("orgId") UUID orgId,
      @Param("statuses") Collection<StatusCommon> statuses,
      Pageable pageable);
}
