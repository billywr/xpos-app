package com.blinc.xpos.modules.organization.repository;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.modules.organization.domain.Terminal;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TerminalRepository extends JpaRepository<Terminal, UUID> {

  @Query(
      """
select t
            from Terminal t
            where t.id = :id
              and t.org.id = :orgId
            """)
  Optional<Terminal> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query("""
      select t from Terminal t
      where t.org.id = :orgId and t.branch.id = :branchId and t.status in :statuses
      """)
  Page<Terminal> findAllByOrgIdAndBranchIdAndStatusIn(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("statuses") Collection<StatusCommon> statuses,
      Pageable pageable);
}
