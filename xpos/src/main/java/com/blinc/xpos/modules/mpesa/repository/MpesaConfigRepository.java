package com.blinc.xpos.modules.mpesa.repository;

import com.blinc.xpos.modules.mpesa.domain.MpesaConfig;
import com.blinc.xpos.modules.mpesa.domain.MpesaConfigStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MpesaConfigRepository extends JpaRepository<MpesaConfig, UUID> {

  @Query(
      """
      select c from MpesaConfig c
      left join fetch c.org
      left join fetch c.branch
      where c.org.id = :orgId and c.id = :configId
      """)
  Optional<MpesaConfig> findByIdAndOrgId(
      @Param("orgId") UUID orgId, @Param("configId") UUID configId);

  @Query(
      """
      select c from MpesaConfig c
      left join fetch c.org
      left join fetch c.branch
      where c.org.id = :orgId
      order by c.branch.id nulls first, c.createdAt desc
      """)
  List<MpesaConfig> findAllByOrgId(@Param("orgId") UUID orgId);

  @Query(
      """
      select c from MpesaConfig c
      left join fetch c.org
      left join fetch c.branch
      where c.org.id = :orgId and c.branch.id = :branchId and c.status = :status
      """)
  Optional<MpesaConfig> findActiveByOrgIdAndBranchId(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("status") MpesaConfigStatus status);

  @Query(
      """
      select c from MpesaConfig c
      left join fetch c.org
      where c.org.id = :orgId and c.branch is null and c.status = :status
      """)
  Optional<MpesaConfig> findActiveOrgDefault(
      @Param("orgId") UUID orgId, @Param("status") MpesaConfigStatus status);
}
