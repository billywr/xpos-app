package com.blinc.xpos.modules.sales.repository;

import com.blinc.xpos.common.constants.enums.SaleStatus;
import com.blinc.xpos.modules.sales.domain.Sale;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SaleRepository extends JpaRepository<Sale, UUID> {

  @Query("""
      select s from Sale s
      where s.id = :id and s.org.id = :orgId
      """)
  Optional<Sale> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select distinct s from Sale s
      join fetch s.org
      join fetch s.branch
      join fetch s.terminal
      left join fetch s.shift
      join fetch s.createdByStaffUser
      left join fetch s.customer
      left join fetch s.receipt
      where s.id = :id and s.org.id = :orgId
      """)
  Optional<Sale> findByIdAndOrgIdWithAssociations(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select s from Sale s
      where s.org.id = :orgId and s.branch.id = :branchId and s.terminal.id = :terminalId
      and s.status in :statuses
      order by s.createdAt desc
      """)
  List<Sale> findByOrgIdAndBranchIdAndTerminalIdAndStatusIn(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("terminalId") UUID terminalId,
      @Param("statuses") List<SaleStatus> statuses);

  @Query(
      """
      select distinct s from Sale s
      join fetch s.org
      join fetch s.branch
      join fetch s.terminal
      left join fetch s.shift
      join fetch s.createdByStaffUser
      left join fetch s.customer
      left join fetch s.receipt
      where s.org.id = :orgId and s.branch.id = :branchId and s.terminal.id = :terminalId
      and s.status in :statuses
      order by s.createdAt desc
      """)
  List<Sale> findByOrgIdAndBranchIdAndTerminalIdAndStatusInWithAssociations(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("terminalId") UUID terminalId,
      @Param("statuses") List<SaleStatus> statuses);

  @Query(
      """
      select s from Sale s
      where s.branch.id = :branchId and s.status = :status
      and s.completedAt >= :start and s.completedAt < :end
      order by s.completedAt
      """)
  List<Sale> findByBranchIdAndStatusAndCompletedAtBetween(
      @Param("branchId") UUID branchId,
      @Param("status") SaleStatus status,
      @Param("start") Instant start,
      @Param("end") Instant end);

  @Query(
      value =
          """
      select distinct s from Sale s
      left join fetch s.receipt
      join fetch s.createdByStaffUser
      where s.org.id = :orgId and s.branch.id = :branchId and s.status = :status
      and s.completedAt >= :start and s.completedAt < :end
      """,
      countQuery =
          """
      select count(s) from Sale s
      where s.org.id = :orgId and s.branch.id = :branchId and s.status = :status
      and s.completedAt >= :start and s.completedAt < :end
      """)
  Page<Sale> findByOrgIdAndBranchIdAndStatusAndCompletedAtBetween(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("status") SaleStatus status,
      @Param("start") Instant start,
      @Param("end") Instant end,
      Pageable pageable);

  @Query(
      """
      select s from Sale s
      where s.shift.id = :shiftId and s.status = :status
      order by s.completedAt
      """)
  List<Sale> findByShiftIdAndStatus(
      @Param("shiftId") UUID shiftId, @Param("status") SaleStatus status);

  @Query(
      """
      select s from Sale s
      where s.org.id = :orgId and s.branch.id = :branchId and s.status = :status
      and s.completedAt >= :start and s.completedAt < :end
      order by s.completedAt
      """)
  List<Sale> findListByOrgIdAndBranchIdAndStatusAndCompletedAtBetween(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("status") SaleStatus status,
      @Param("start") Instant start,
      @Param("end") Instant end);

  @Query(
      """
      select distinct s from Sale s
      left join fetch s.receipt
      where s.org.id = :orgId and s.branch.id = :branchId
      and s.status = :status and s.businessDate = :businessDate
      order by s.completedAt
      """)
  List<Sale> findByOrgBranchStatusAndBusinessDate(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("status") SaleStatus status,
      @Param("businessDate") LocalDate businessDate);
}
