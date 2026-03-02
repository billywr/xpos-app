package com.blinc.xpos.modules.fraud.repository;

import com.blinc.xpos.modules.fraud.domain.ApprovalPolicy;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ApprovalPolicyRepository extends JpaRepository<ApprovalPolicy, UUID> {

  @Query(
      """
      select p from ApprovalPolicy p
      where p.id = :id and p.org.id = :orgId
      """)
  Optional<ApprovalPolicy> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select p from ApprovalPolicy p
      where p.org.id = :orgId
      order by p.policyCode
      """)
  Page<ApprovalPolicy> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);
}
