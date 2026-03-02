package com.blinc.xpos.modules.cash.repository;

import com.blinc.xpos.common.constants.enums.ShiftStatus;
import com.blinc.xpos.modules.cash.domain.Shift;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ShiftRepository extends JpaRepository<Shift, UUID> {

  @Query(
      """
      select s from Shift s
      where s.id = :id and s.org.id = :orgId
      """)
  Optional<Shift> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select s from Shift s
      where s.terminal.id = :terminalId and s.status = :status
      """)
  Optional<Shift> findByTerminalIdAndStatus(
      @Param("terminalId") UUID terminalId, @Param("status") ShiftStatus status);

  @Query(
      """
      select s from Shift s
      where s.branch.id = :branchId and s.org.id = :orgId
      """)
  Page<Shift> findAllByBranchId(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId, Pageable pageable);

  @Query(
      """
      select s from Shift s
      where s.branch.id = :branchId and s.status = :status
      order by s.openedAt desc
      """)
  List<Shift> findByBranchIdAndStatus(
      @Param("branchId") UUID branchId, @Param("status") ShiftStatus status);

  @Query(
      """
      select count(s) > 0 from Shift s
      where s.branch.id = :branchId and s.status = :status
      """)
  boolean existsByBranchIdAndStatus(
      @Param("branchId") UUID branchId, @Param("status") ShiftStatus status);

  @Query(
      """
      select s from Shift s
      where s.org.id = :orgId and s.status = :status
      """)
  Page<Shift> findAllByOrgIdAndStatus(
      @Param("orgId") UUID orgId, @Param("status") ShiftStatus status, Pageable pageable);
}
