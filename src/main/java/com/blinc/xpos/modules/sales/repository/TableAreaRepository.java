package com.blinc.xpos.modules.sales.repository;

import com.blinc.xpos.modules.sales.domain.TableArea;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TableAreaRepository extends JpaRepository<TableArea, UUID> {

  @Query(
      """
      select t from TableArea t
      where t.id = :id and t.org.id = :orgId
      """)
  Optional<TableArea> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select t from TableArea t
      where t.branch.id = :branchId and t.org.id = :orgId
      """)
  Page<TableArea> findAllByBranchIdAndOrgId(
      @Param("branchId") UUID branchId, @Param("orgId") UUID orgId, Pageable pageable);
}
