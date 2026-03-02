package com.blinc.xpos.modules.auditvault.repository;

import com.blinc.xpos.modules.auditvault.domain.AuditVaultRecord;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditVaultRecordRepository extends JpaRepository<AuditVaultRecord, UUID> {

  @Query(
      """
      select v from AuditVaultRecord v
      where v.id = :id and v.org.id = :orgId
      """)
  Optional<AuditVaultRecord> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select v from AuditVaultRecord v
      where v.org.id = :orgId
      order by v.createdAt desc
      """)
  Page<AuditVaultRecord> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);

  @Query(
      """
      select v from AuditVaultRecord v
      where v.org.id = :orgId and v.branch.id = :branchId
      order by v.createdAt desc
      """)
  Page<AuditVaultRecord> findAllByOrgIdAndBranchId(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId, Pageable pageable);

}
