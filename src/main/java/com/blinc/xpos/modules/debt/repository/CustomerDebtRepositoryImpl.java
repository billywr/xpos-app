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

  @Override
  public List<com.blinc.xpos.modules.debt.dto.DebtGroupSummaryProjection> findGroupedDebts(
      UUID orgId,
      UUID branchId,
      String groupBy,
      List<String> statusNames,
      Instant from,
      Instant to) {
    Query query = buildGroupQuery(orgId, branchId, groupBy, statusNames, from, to);
    @SuppressWarnings("unchecked")
    List<Object[]> rows = query.getResultList();
    return rows.stream().map(CustomerDebtRepositoryImpl::mapDebtGroupRow).toList();
  }

  private Query buildGroupQuery(
      UUID orgId,
      UUID branchId,
      String groupBy,
      List<String> statusNames,
      Instant from,
      Instant to) {
    boolean hasStatuses = statusNames != null && !statusNames.isEmpty();
    boolean hasDates = from != null && to != null;

    String groupKeyCol;
    String groupLabelCol;
    String phoneCol;
    String groupByClause;
    String orderByClause;

    if ("issuedBy".equalsIgnoreCase(groupBy)) {
      groupKeyCol = "COALESCE(NULLIF(TRIM(cd.issued_by), ''), 'Unassigned')";
      groupLabelCol = "COALESCE(NULLIF(TRIM(cd.issued_by), ''), 'Unassigned')";
      phoneCol = "NULL";
      groupByClause = "GROUP BY COALESCE(NULLIF(TRIM(cd.issued_by), ''), 'Unassigned')";
      orderByClause = "ORDER BY total_outstanding DESC, group_label ASC";
    } else if ("status".equalsIgnoreCase(groupBy)) {
      groupKeyCol = "cd.status::text";
      groupLabelCol =
          "case when cd.status::text = 'SETTLED' then 'CLOSED' else cd.status::text end";
      phoneCol = "NULL";
      groupByClause = "GROUP BY cd.status::text";
      orderByClause = "ORDER BY total_outstanding DESC, group_label ASC";
    } else if ("date".equalsIgnoreCase(groupBy)) {
      groupKeyCol = "TO_CHAR(cd.created_at, 'YYYY-MM-DD')";
      groupLabelCol = "TO_CHAR(cd.created_at, 'YYYY-MM-DD')";
      phoneCol = "NULL";
      groupByClause = "GROUP BY TO_CHAR(cd.created_at, 'YYYY-MM-DD')";
      orderByClause = "ORDER BY group_key DESC";
    } else {
      groupKeyCol = "cd.customer_id::text";
      groupLabelCol = "c.name";
      phoneCol = "c.phone";
      groupByClause = "GROUP BY cd.customer_id, c.name, c.phone";
      orderByClause = "ORDER BY total_outstanding DESC, c.name ASC";
    }

    StringBuilder sql = new StringBuilder();
    sql.append("SELECT ")
        .append(groupKeyCol)
        .append(" AS group_key, ")
        .append(groupLabelCol)
        .append(" AS group_label, ")
        .append("COUNT(*) AS debt_count, ")
        .append("COALESCE(SUM(cd.amount), 0) AS total_amount, ")
        .append("COALESCE(SUM(cd.amount_settled), 0) AS total_settled, ")
        .append("COALESCE(SUM(cd.amount - cd.amount_settled), 0) AS total_outstanding, ")
        .append(phoneCol)
        .append(" AS customer_phone ")
        .append("FROM customer_debt cd ")
        .append("JOIN customer c ON c.id = cd.customer_id ")
        .append("WHERE cd.org_id = :orgId AND cd.branch_id = :branchId ");

    if (hasStatuses) {
      sql.append("AND cd.status::text IN (:statusNames) ");
    }
    if (hasDates) {
      sql.append("AND cd.created_at >= :fromTs AND cd.created_at < :toTs ");
    }

    sql.append(groupByClause).append(" ").append(orderByClause);

    Query query = entityManager.createNativeQuery(sql.toString());
    query.setParameter("orgId", orgId);
    query.setParameter("branchId", branchId);
    if (hasStatuses) {
      query.setParameter("statusNames", statusNames);
    }
    if (hasDates) {
      query.setParameter("fromTs", from);
      query.setParameter("toTs", to);
    }
    return query;
  }

  private static com.blinc.xpos.modules.debt.dto.DebtGroupSummaryProjection mapDebtGroupRow(
      Object[] row) {
    String key = row[0] != null ? row[0].toString() : "";
    String label = row[1] != null ? row[1].toString() : "";
    long count = row[2] instanceof Number n ? n.longValue() : 0L;
    java.math.BigDecimal amount = toBigDecimal(row[3]);
    java.math.BigDecimal settled = toBigDecimal(row[4]);
    java.math.BigDecimal outstanding = toBigDecimal(row[5]);
    String phone = row[6] != null ? row[6].toString() : null;
    return new com.blinc.xpos.modules.debt.dto.DebtGroupSummaryProjection(
        key, label, count, amount, settled, outstanding, phone);
  }

  private static java.math.BigDecimal toBigDecimal(Object val) {
    if (val instanceof java.math.BigDecimal b) {
      return b;
    }
    if (val instanceof Number n) {
      return java.math.BigDecimal.valueOf(n.doubleValue());
    }
    return java.math.BigDecimal.ZERO;
  }
}
