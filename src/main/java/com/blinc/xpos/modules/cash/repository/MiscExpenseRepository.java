package com.blinc.xpos.modules.cash.repository;

import com.blinc.xpos.modules.cash.domain.MiscExpense;
import com.blinc.xpos.modules.cash.dto.ExpenseCategorySum;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MiscExpenseRepository extends JpaRepository<MiscExpense, UUID> {

  @Query(
      """
      select e from MiscExpense e
      where e.id = :id and e.org.id = :orgId
      """)
  Optional<MiscExpense> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      value =
          """
          select e from MiscExpense e
          left join fetch e.createdBy
          where e.org.id = :orgId and e.branch.id = :branchId and e.deletedAt is null
          order by e.createdAt desc
          """,
      countQuery =
          """
          select count(e) from MiscExpense e
          where e.org.id = :orgId and e.branch.id = :branchId and e.deletedAt is null
          """)
  Page<MiscExpense> findAllByOrgIdAndBranchId(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId, Pageable pageable);

  @Query(
      value =
          """
          select e from MiscExpense e
          left join fetch e.createdBy
          where e.org.id = :orgId and e.branch.id = :branchId
          and e.deletedAt is null
          and e.createdAt >= :fromTs and e.createdAt < :toTs
          order by e.createdAt desc
          """,
      countQuery =
          """
          select count(e) from MiscExpense e
          where e.org.id = :orgId and e.branch.id = :branchId
          and e.deletedAt is null
          and e.createdAt >= :fromTs and e.createdAt < :toTs
          """)
  Page<MiscExpense> findAllByOrgIdAndBranchIdAndCreatedAtBetween(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("fromTs") Instant fromTs,
      @Param("toTs") Instant toTs,
      Pageable pageable);

  @Query(
      """
      select e from MiscExpense e
      where e.org.id = :orgId and e.branch.id = :branchId and e.deletedAt is null
      and e.createdAt >= :from and e.createdAt < :to
      """)
  List<MiscExpense> findListByOrgIdAndBranchIdAndCreatedAtBetween(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("from") Instant from,
      @Param("to") Instant to);

  @Query(
      """
      select coalesce(sum(e.amount), 0) from MiscExpense e
      where e.org.id = :orgId and e.branch.id = :branchId and e.deletedAt is null
      and e.createdAt >= :from and e.createdAt < :to
      """)
  BigDecimal sumAmountByOrgIdAndBranchIdAndCreatedAtBetween(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("from") Instant from,
      @Param("to") Instant to);

  @Query(
      """
      select e.category as category, coalesce(sum(e.amount), 0) as amount from MiscExpense e
      where e.org.id = :orgId and e.branch.id = :branchId and e.deletedAt is null
      and e.createdAt >= :from and e.createdAt < :to
      group by e.category
      """)
  List<ExpenseCategorySum> sumAmountByCategoryByOrgIdAndBranchIdAndCreatedAtBetween(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("from") Instant from,
      @Param("to") Instant to);

  @Query(
      """
      select coalesce(sum(e.amount), 0) from MiscExpense e
      where e.org.id = :orgId and e.branch.id = :branchId and e.deletedAt is null
      """)
  BigDecimal sumAmountByOrgIdAndBranchId(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId);

  @Query(
      """
      select coalesce(sum(e.amount), 0) from MiscExpense e
      where e.org.id = :orgId and e.branch.id = :branchId
      and e.deletedAt is null
      and e.createdAt >= :fromTs and e.createdAt < :toTs
      """)
  BigDecimal sumAmountByOrgIdAndBranchIdAndDateRange(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("fromTs") Instant fromTs,
      @Param("toTs") Instant toTs);
}
