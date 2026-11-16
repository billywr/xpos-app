package com.blinc.xpos.modules.compliance.repository;

import com.blinc.xpos.modules.compliance.domain.VscuConfig;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VscuConfigRepository extends JpaRepository<VscuConfig, UUID> {

  @Query(
      """
      select v from VscuConfig v
      where v.id = :id and v.org.id = :orgId
      """)
  Optional<VscuConfig> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select v from VscuConfig v
      where v.org.id = :orgId
      order by v.branch.id
      """)
  Page<VscuConfig> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);

  @Query(
      """
      select v from VscuConfig v
      where v.org.id = :orgId and v.branch.id = :branchId
      """)
  Optional<VscuConfig> findByOrgIdAndBranchId(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId);
}
