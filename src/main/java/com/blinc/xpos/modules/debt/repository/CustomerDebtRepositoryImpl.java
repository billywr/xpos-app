package com.blinc.xpos.modules.debt.repository;

import com.blinc.xpos.modules.debt.domain.CustomerDebt;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

public class CustomerDebtRepositoryImpl implements CustomerDebtRepositoryCustom {

  private final EntityManager entityManager;

  public CustomerDebtRepositoryImpl(EntityManager entityManager) {
    this.entityManager = entityManager;
  }

  @Override
  public Page<CustomerDebt> findAllByOrgIdAndBranchIdAndStatusIn(
      UUID orgId, UUID branchId, List<String> statusNames, Pageable pageable) {
    String countSql =
        """
        select count(*) from customer_debt cd
        where cd.org_id = :orgId and cd.branch_id = :branchId
        and cd.status::text in (:statusNames)
        """;
    Query countQuery = entityManager.createNativeQuery(countSql);
    countQuery.setParameter("orgId", orgId);
    countQuery.setParameter("branchId", branchId);
    countQuery.setParameter("statusNames", statusNames);
    long total = ((Number) countQuery.getSingleResult()).longValue();

    String idsSql =
        """
        select cd.id from customer_debt cd
        where cd.org_id = :orgId and cd.branch_id = :branchId
        and cd.status::text in (:statusNames)
        order by case when cd.status::text in ('OPEN','PARTIAL') then 0 else 1 end asc,
        cd.created_at desc
        """;

    Query idsQuery = entityManager.createNativeQuery(idsSql);
    idsQuery.setParameter("orgId", orgId);
    idsQuery.setParameter("branchId", branchId);
    idsQuery.setParameter("statusNames", statusNames);
    idsQuery.setFirstResult((int) pageable.getOffset());
    idsQuery.setMaxResults(pageable.getPageSize());

    @SuppressWarnings("unchecked")
    List<Object> idRows = idsQuery.getResultList();
    if (idRows.isEmpty()) {
      return new PageImpl<>(List.of(), pageable, total);
    }

    List<UUID> ids =
        idRows.stream()
            .map(
                row -> {
                  if (row instanceof UUID u) {
                    return u;
                  }
                  return UUID.fromString(row.toString());
                })
            .toList();

    String jpql =
        """
        select d from CustomerDebt d
        left join fetch d.customer
        left join fetch d.createdBy
        where d.id in :ids
        order by d.createdAt desc
        """;

    Query fetchQuery = entityManager.createQuery(jpql);
    fetchQuery.setParameter("ids", ids);
    @SuppressWarnings("unchecked")
    List<CustomerDebt> fetched = fetchQuery.getResultList();

    Map<UUID, CustomerDebt> byId = new LinkedHashMap<>();
    for (CustomerDebt d : fetched) {
      byId.put(d.getId(), d);
    }
    List<CustomerDebt> ordered = ids.stream().map(byId::get).filter(e -> e != null).toList();

    return new PageImpl<>(ordered, pageable, total);
  }

  @Override
  public Page<CustomerDebt> findAllByOrgIdAndBranchIdAndStatusInAndCreatedAtBetween(
      UUID orgId,
      UUID branchId,
      List<String> statusNames,
      Instant from,
      Instant to,
      Pageable pageable) {
    String countSql =
        """
        select count(*) from customer_debt cd
        where cd.org_id = :orgId and cd.branch_id = :branchId
        and cd.status::text in (:statusNames)
        and cd.created_at >= :fromTs and cd.created_at < :toTs
        """;
    Query countQuery = entityManager.createNativeQuery(countSql);
    countQuery.setParameter("orgId", orgId);
    countQuery.setParameter("branchId", branchId);
    countQuery.setParameter("statusNames", statusNames);
    countQuery.setParameter("fromTs", from);
    countQuery.setParameter("toTs", to);
    long total = ((Number) countQuery.getSingleResult()).longValue();

    String idsSql =
        """
        select cd.id from customer_debt cd
        where cd.org_id = :orgId and cd.branch_id = :branchId
        and cd.status::text in (:statusNames)
        and cd.created_at >= :fromTs and cd.created_at < :toTs
        order by case when cd.status::text in ('OPEN','PARTIAL')
        then 0 else 1 end asc, cd.created_at desc
        """;

    Query idsQuery = entityManager.createNativeQuery(idsSql);
    idsQuery.setParameter("orgId", orgId);
    idsQuery.setParameter("branchId", branchId);
    idsQuery.setParameter("statusNames", statusNames);
    idsQuery.setParameter("fromTs", from);
    idsQuery.setParameter("toTs", to);
    idsQuery.setFirstResult((int) pageable.getOffset());
    idsQuery.setMaxResults(pageable.getPageSize());

    @SuppressWarnings("unchecked")
    List<Object> idRows = idsQuery.getResultList();
    if (idRows.isEmpty()) {
      return new PageImpl<>(List.of(), pageable, total);
    }

    List<UUID> ids =
        idRows.stream()
            .map(
                row -> {
                  if (row instanceof UUID u) {
                    return u;
                  }
                  return UUID.fromString(row.toString());
                })
            .toList();

    String jpql =
        """
        select d from CustomerDebt d
        left join fetch d.customer
        left join fetch d.createdBy
        where d.id in :ids
        order by d.createdAt desc
        """;

    Query fetchQuery = entityManager.createQuery(jpql);
    fetchQuery.setParameter("ids", ids);
    @SuppressWarnings("unchecked")
    List<CustomerDebt> fetched = fetchQuery.getResultList();

    Map<UUID, CustomerDebt> byId = new LinkedHashMap<>();
    for (CustomerDebt d : fetched) {
      byId.put(d.getId(), d);
    }
    List<CustomerDebt> ordered = ids.stream().map(byId::get).filter(e -> e != null).toList();

    return new PageImpl<>(ordered, pageable, total);
  }
}
