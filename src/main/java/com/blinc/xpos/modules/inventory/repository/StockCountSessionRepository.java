package com.blinc.xpos.modules.inventory.repository;

import com.blinc.xpos.modules.inventory.domain.StockCountSession;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StockCountSessionRepository extends JpaRepository<StockCountSession, UUID> {

  @Query(
      """
      select s from StockCountSession s
      where s.id = :id and s.org.id = :orgId
      """)
  Optional<StockCountSession> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select s from StockCountSession s
      where s.org.id = :orgId and s.branch.id = :branchId
      """)
  Page<StockCountSession> findAllByOrgIdAndBranchId(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId, Pageable pageable);
}
