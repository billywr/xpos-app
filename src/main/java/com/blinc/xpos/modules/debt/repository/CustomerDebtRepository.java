package com.blinc.xpos.modules.debt.repository;

import com.blinc.xpos.modules.debt.domain.CustomerDebt;
import com.blinc.xpos.modules.debt.dto.TopDebtorProjection;
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

public interface CustomerDebtRepository
    extends JpaRepository<CustomerDebt, UUID>, CustomerDebtRepositoryCustom {

  @Query(
      """
      select d from CustomerDebt d
      left join fetch d.customer
      left join fetch d.createdBy
      where d.id = :id and d.org.id = :orgId
      """)
  Optional<CustomerDebt> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select d from CustomerDebt d
      where d.sale.id = :saleId and d.org.id = :orgId
      order by d.createdAt desc
      """)
  java.util.List<CustomerDebt> findAllBySaleIdAndOrgId(
      @Param("saleId") UUID saleId, @Param("orgId") UUID orgId);

  @Query(
      value =
          """
          select d from CustomerDebt d
          left join fetch d.customer
          left join fetch d.createdBy
          where d.org.id = :orgId and d.branch.id = :branchId
          order by case when (d.status = com.blinc.xpos.common.constants.enums.CustomerDebtStatus.SETTLED
              or d.status = com.blinc.xpos.common.constants.enums.CustomerDebtStatus.CANCELLED)
              then 1 else 0 end asc, d.createdAt desc
          """,
      countQuery =
          """
          select count(d) from CustomerDebt d
          where d.org.id = :orgId and d.branch.id = :branchId
          """)
  Page<CustomerDebt> findAllByOrgIdAndBranchId(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId, Pageable pageable);

  @Query(
      """
      select d from CustomerDebt d
      where d.org.id = :orgId and d.customer.id = :customerId
      order by d.createdAt desc
      """)
  Page<CustomerDebt> findAllByOrgIdAndCustomerId(
      @Param("orgId") UUID orgId, @Param("customerId") UUID customerId, Pageable pageable);

  @Query(
      value =
          """
          select d from CustomerDebt d
          left join fetch d.customer
          left join fetch d.createdBy
          where d.org.id = :orgId and d.branch.id = :branchId
          and d.createdAt >= :fromTs and d.createdAt < :toTs
          order by case when (d.status
              = com.blinc.xpos.common.constants.enums.CustomerDebtStatus.SETTLED
              or d.status
              = com.blinc.xpos.common.constants.enums.CustomerDebtStatus.CANCELLED)
              then 1 else 0 end asc, d.createdAt desc
          """,
      countQuery =
          """
          select count(d) from CustomerDebt d
          where d.org.id = :orgId and d.branch.id = :branchId
          and d.createdAt >= :fromTs and d.createdAt < :toTs
          """)
  Page<CustomerDebt> findAllByOrgIdAndBranchIdAndCreatedAtBetween(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("fromTs") Instant fromTs,
      @Param("toTs") Instant toTs,
      Pageable pageable);

  @Query(
      value =
          """
          select * from customer_debt cd
          where cd.org_id = :orgId and cd.branch_id = :branchId
          and cd.status::text in (:statusNames) and cd.created_at >= :from and cd.created_at < :to
          order by cd.created_at desc
          """,
      nativeQuery = true)
  List<CustomerDebt> findListByOrgIdAndBranchIdAndStatusInAndCreatedAtBetween(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("statusNames") List<String> statusNames,
      @Param("from") Instant from,
      @Param("to") Instant to);

  @Query(
      value =
          """
          select coalesce(sum(cd.amount - cd.amount_settled), 0) from customer_debt cd
          where cd.org_id = :orgId and cd.branch_id = :branchId
          and cd.status::text in (:statusNames)
          """,
      nativeQuery = true)
  BigDecimal sumOutstandingByOrgIdAndBranchIdAndStatusIn(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("statusNames") List<String> statusNames);

  @Query(
      value =
          """
          select coalesce(sum(cd.amount - cd.amount_settled), 0) from customer_debt cd
          where cd.org_id = :orgId and cd.branch_id = :branchId
          and cd.status::text in (:statusNames) and cd.due_date < :asOfDate
          """,
      nativeQuery = true)
  BigDecimal sumOverdueByOrgIdAndBranchIdAndStatusInAndDueDateBefore(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("statusNames") List<String> statusNames,
      @Param("asOfDate") java.time.LocalDate asOfDate);

  @Query(
      value =
          """
          select count(*) from customer_debt cd
          where cd.org_id = :orgId and cd.branch_id = :branchId
          and cd.status::text in (:statusNames)
          """,
      nativeQuery = true)
  long countByOrgIdAndBranchIdAndStatusIn(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("statusNames") List<String> statusNames);

  @Query(
      value =
          """
          select coalesce(sum(cd.amount), 0) from customer_debt cd
          where cd.org_id = :orgId and cd.branch_id = :branchId
          and cd.status::text in (:statusNames)
          """,
      nativeQuery = true)
  BigDecimal sumAmountByOrgIdAndBranchIdAndStatusIn(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("statusNames") List<String> statusNames);

  @Query(
      value =
          """
          select coalesce(sum(cd.amount_settled), 0) from customer_debt cd
          where cd.org_id = :orgId and cd.branch_id = :branchId
          and cd.status::text in (:statusNames)
          """,
      nativeQuery = true)
  BigDecimal sumAmountSettledByOrgIdAndBranchIdAndStatusIn(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("statusNames") List<String> statusNames);

  @Query(
      """
      select new com.blinc.xpos.modules.debt.dto.TopDebtorProjection(
          c.id, c.name, sum(d.amount - d.amountSettled))
      from CustomerDebt d
      join d.customer c
      where d.org.id = :orgId and d.branch.id = :branchId
      and d.status in (
          com.blinc.xpos.common.constants.enums.CustomerDebtStatus.OPEN,
          com.blinc.xpos.common.constants.enums.CustomerDebtStatus.PARTIAL)
      group by c.id, c.name
      order by sum(d.amount - d.amountSettled) desc
      """)
  List<TopDebtorProjection> findTopDebtorsByOrgAndBranch(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId, Pageable pageable);

  @Query(
      """
      select d from CustomerDebt d
      join fetch d.customer
      where d.org.id = :orgId and d.branch.id = :branchId
      and d.status in (
          com.blinc.xpos.common.constants.enums.CustomerDebtStatus.OPEN,
          com.blinc.xpos.common.constants.enums.CustomerDebtStatus.PARTIAL)
      and d.dueDate is not null and d.dueDate < :asOfDate
      order by d.dueDate asc
      """)
  List<com.blinc.xpos.modules.debt.domain.CustomerDebt> findOverdueByOrgAndBranch(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("asOfDate") java.time.LocalDate asOfDate,
      Pageable pageable);
}
