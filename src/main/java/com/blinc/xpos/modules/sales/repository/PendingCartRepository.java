package com.blinc.xpos.modules.sales.repository;

import com.blinc.xpos.modules.sales.domain.PendingCart;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PendingCartRepository extends JpaRepository<PendingCart, UUID> {

  @Query(
      value =
          """
      select * from pending_cart pc
      where pc.org_id = :orgId and pc.branch_id = :branchId
        and pc.iam_user_id = CAST(:iamUserId AS text)
      """,
      nativeQuery = true)
  Optional<PendingCart> findByOrgIdAndBranchIdAndIamUserId(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("iamUserId") String iamUserId);

  @Modifying
  @Query(
      value =
          """
      delete from pending_cart pc
      where pc.org_id = :orgId and pc.branch_id = :branchId
        and pc.iam_user_id = CAST(:iamUserId AS text)
      """,
      nativeQuery = true)
  void deleteByOrgIdAndBranchIdAndIamUserId(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("iamUserId") String iamUserId);
}
