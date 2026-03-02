package com.blinc.xpos.modules.auditvault.repository;

import com.blinc.xpos.modules.auditvault.domain.AuditLog;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

  @Query(
      """
      select a from AuditLog a
      where a.id = :id and a.org.id = :orgId
      """)
  Optional<AuditLog> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select a from AuditLog a
      where a.org.id = :orgId
      order by a.createdAt desc
      """)
  Page<AuditLog> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);

  @Query(
      """
      select a from AuditLog a
      where a.org.id = :orgId and a.branch.id = :branchId
      order by a.createdAt desc
      """)
  Page<AuditLog> findAllByOrgIdAndBranchId(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId, Pageable pageable);
}
