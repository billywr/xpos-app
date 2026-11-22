package com.blinc.xpos.modules.cash.repository;

import com.blinc.xpos.modules.cash.domain.RecurringUtilityExpense;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RecurringUtilityExpenseRepository
    extends JpaRepository<RecurringUtilityExpense, UUID> {

  @Query(
      """
      select u from RecurringUtilityExpense u
      left join fetch u.createdBy
      where u.id = :id and u.org.id = :orgId and u.branch.id = :branchId and u.deletedAt is null
      """)
  Optional<RecurringUtilityExpense> findByIdAndOrgIdAndBranchId(
      @Param("id") UUID id, @Param("orgId") UUID orgId, @Param("branchId") UUID branchId);

  @Query(
      value =
          """
          select u from RecurringUtilityExpense u
          left join fetch u.createdBy
          where u.org.id = :orgId and u.branch.id = :branchId and u.deletedAt is null
            and (
              :active is null
              or (:active = true and u.active = true
                  and (u.effectiveFrom is null or u.effectiveFrom <= current_date)
                  and (u.effectiveTo is null or u.effectiveTo >= current_date))
              or (:active = false
                  and (u.active = false
                       or (u.effectiveFrom is not null and u.effectiveFrom > current_date)
                       or (u.effectiveTo is not null and u.effectiveTo < current_date)))
            )
            and (:pattern is null
                 or lower(u.name) like :pattern
                 or (u.payee is not null and lower(u.payee) like :pattern)
                 or (u.accountNumber is not null and lower(u.accountNumber) like :pattern))
          order by u.createdAt desc
          """,
      countQuery =
          """
          select count(u) from RecurringUtilityExpense u
          where u.org.id = :orgId and u.branch.id = :branchId and u.deletedAt is null
            and (
              :active is null
              or (:active = true and u.active = true
                  and (u.effectiveFrom is null or u.effectiveFrom <= current_date)
                  and (u.effectiveTo is null or u.effectiveTo >= current_date))
              or (:active = false
                  and (u.active = false
                       or (u.effectiveFrom is not null and u.effectiveFrom > current_date)
                       or (u.effectiveTo is not null and u.effectiveTo < current_date)))
            )
            and (:pattern is null
                 or lower(u.name) like :pattern
                 or (u.payee is not null and lower(u.payee) like :pattern)
                 or (u.accountNumber is not null and lower(u.accountNumber) like :pattern))
          """)
  Page<RecurringUtilityExpense> findAllByOrgIdAndBranchIdAndFilter(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("active") Boolean active,
      @Param("pattern") String pattern,
      Pageable pageable);

  @Query(
      """
      select u from RecurringUtilityExpense u
      where u.org.id = :orgId and u.branch.id = :branchId and u.active = true and u.deletedAt is null
        and (u.effectiveFrom is null or u.effectiveFrom <= current_date)
        and (u.effectiveTo is null or u.effectiveTo >= current_date)
      order by u.dueDayOfMonth asc, u.name asc
      """)
  List<RecurringUtilityExpense> findAllActiveByOrgIdAndBranchId(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId);

  @Query(
      """
      select u from RecurringUtilityExpense u
      left join fetch u.createdBy
      where u.org.id = :orgId and u.branch.id = :branchId and u.deletedAt is null
        and (u.active = true or u.effectiveTo is not null)
        and (u.effectiveFrom is null or u.effectiveFrom <= :endDate)
        and (u.effectiveTo is null or u.effectiveTo >= :startDate)
      order by u.effectiveFrom asc, u.dueDayOfMonth asc, u.name asc
      """)
  List<RecurringUtilityExpense> findApplicableForPeriod(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("startDate") LocalDate startDate,
      @Param("endDate") LocalDate endDate);

  @Query(
      """
      select coalesce(sum(u.amount), 0) from RecurringUtilityExpense u
      where u.org.id = :orgId and u.branch.id = :branchId and u.active = true and u.deletedAt is null
        and (u.effectiveFrom is null or u.effectiveFrom <= current_date)
        and (u.effectiveTo is null or u.effectiveTo >= current_date)
      """)
  BigDecimal sumActiveMonthlyAmountByOrgIdAndBranchId(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId);

  @Query(
      """
      select count(u) from RecurringUtilityExpense u
      where u.org.id = :orgId and u.branch.id = :branchId and u.active = true and u.deletedAt is null
        and (u.effectiveFrom is null or u.effectiveFrom <= current_date)
        and (u.effectiveTo is null or u.effectiveTo >= current_date)
      """)
  long countActiveByOrgIdAndBranchId(@Param("orgId") UUID orgId, @Param("branchId") UUID branchId);
}
