package com.blinc.xpos.modules.sales.repository;

import com.blinc.xpos.modules.sales.domain.TableEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TableEntityRepository extends JpaRepository<TableEntity, UUID> {

  @Query(
      """
      select t from TableEntity t
      where t.id = :id and t.org.id = :orgId
      """)
  Optional<TableEntity> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select t from TableEntity t
      where t.branch.id = :branchId and t.org.id = :orgId
      """)
  Page<TableEntity> findAllByBranchIdAndOrgId(
      @Param("branchId") UUID branchId, @Param("orgId") UUID orgId, Pageable pageable);
}
