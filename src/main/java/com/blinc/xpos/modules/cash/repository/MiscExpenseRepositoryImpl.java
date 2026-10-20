package com.blinc.xpos.modules.cash.repository;

import com.blinc.xpos.modules.cash.dto.ExpenseGroupSummaryProjection;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class MiscExpenseRepositoryImpl implements MiscExpenseRepositoryCustom {

  private final EntityManager entityManager;

  public MiscExpenseRepositoryImpl(EntityManager entityManager) {
    this.entityManager = entityManager;
  }

  @Override
  public List<ExpenseGroupSummaryProjection> findGroupedExpenses(
      UUID orgId, UUID branchId, String groupBy, Instant from, Instant to) {
    boolean hasDates = from != null && to != null;

    String groupKeyCol;
    String groupLabelCol;
    String groupByClause;
    String orderByClause;

    if ("incurredBy".equalsIgnoreCase(groupBy)) {
      groupKeyCol = "LOWER(COALESCE(NULLIF(TRIM(e.incurred_by), ''), 'Unassigned'))";
      groupLabelCol = "COALESCE(NULLIF(MAX(TRIM(e.incurred_by)), ''), 'Unassigned')";
      groupByClause = "GROUP BY LOWER(COALESCE(NULLIF(TRIM(e.incurred_by), ''), 'Unassigned'))";
      orderByClause = "ORDER BY total_amount DESC, group_label ASC";
    } else if ("date".equalsIgnoreCase(groupBy)) {
      groupKeyCol = "TO_CHAR(e.created_at, 'YYYY-MM-DD')";
      groupLabelCol = "TO_CHAR(e.created_at, 'YYYY-MM-DD')";
      groupByClause = "GROUP BY TO_CHAR(e.created_at, 'YYYY-MM-DD')";
      orderByClause = "ORDER BY group_key DESC";
    } else {
      // Default: category
      groupKeyCol = "LOWER(TRIM(e.category::text))";
      groupLabelCol = "MAX(e.category::text)";
      groupByClause = "GROUP BY LOWER(TRIM(e.category::text))";
      orderByClause = "ORDER BY total_amount DESC, group_label ASC";
    }

    StringBuilder sql = new StringBuilder();
    sql.append("SELECT ")
        .append(groupKeyCol)
        .append(" AS group_key, ")
        .append(groupLabelCol)
        .append(" AS group_label, ")
        .append("COUNT(*) AS exp_count, ")
        .append("COALESCE(SUM(e.amount), 0) AS total_amount ")
        .append("FROM misc_expense e ")
        .append("WHERE e.org_id = :orgId AND e.branch_id = :branchId AND e.deleted_at IS NULL ");

    if (hasDates) {
      sql.append("AND e.created_at >= :fromTs AND e.created_at < :toTs ");
    }

    sql.append(groupByClause).append(" ").append(orderByClause);

    Query query = entityManager.createNativeQuery(sql.toString());
    query.setParameter("orgId", orgId);
    query.setParameter("branchId", branchId);
    if (hasDates) {
      query.setParameter("fromTs", from);
      query.setParameter("toTs", to);
    }

    @SuppressWarnings("unchecked")
    List<Object[]> rows = query.getResultList();

    return rows.stream()
        .map(
            row -> {
              String key = row[0] != null ? row[0].toString() : "";
              String label = row[1] != null ? row[1].toString() : "";
              long count = row[2] instanceof Number n ? n.longValue() : 0L;
              BigDecimal amount =
                  row[3] instanceof BigDecimal b
                      ? b
                      : (row[3] instanceof Number n
                          ? BigDecimal.valueOf(n.doubleValue())
                          : BigDecimal.ZERO);

              return new ExpenseGroupSummaryProjection(key, label, count, amount);
            })
        .toList();
  }
}
