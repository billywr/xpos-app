package com.blinc.xpos.common.error;

import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;

/**
 * Translates low-level database constraint failures into safe, actionable messages.
 *
 * <p>This class intentionally avoids database-driver-specific types to keep the dependency graph
 * clean and resilient. It relies on SQLSTATE + best-effort parsing of the exception message to
 * identify the violated constraint.
 */
public class DatabaseErrorTranslator {

  private static final String SQLSTATE_UNIQUE_VIOLATION = "23505";
  private static final String SQLSTATE_FK_VIOLATION = "23503";
  private static final String SQLSTATE_NOT_NULL_VIOLATION = "23502";
  private static final String SQLSTATE_CHECK_VIOLATION = "23514";

  private static final Pattern CONSTRAINT_QUOTED_PATTERN =
      Pattern.compile("constraint \\\"([^\\\"]+)\\\"", Pattern.CASE_INSENSITIVE);

  private final ConstraintMessageCatalog catalog;

  public DatabaseErrorTranslator(ConstraintMessageCatalog catalog) {
    this.catalog = Objects.requireNonNull(catalog, "catalog");
  }

  public DatabaseErrorTranslation translate(DataIntegrityViolationException ex) {
    SQLException sql = unwrap(ex, SQLException.class);
    if (sql == null) {
      return new DatabaseErrorTranslation(
          HttpStatus.CONFLICT,
          "DATA_INTEGRITY_VIOLATION",
          "Request violates a data integrity rule.",
          List.of());
    }

    String sqlState = safe(sql.getSQLState());
    String constraint = extractConstraintName(sql);
    String friendly = this.catalog.messageFor(constraint);

    if (SQLSTATE_UNIQUE_VIOLATION.equals(sqlState)) {
      return uniqueViolation(constraint, friendly);
    }
    if (SQLSTATE_FK_VIOLATION.equals(sqlState)) {
      return fkViolation(constraint, friendly);
    }
    if (SQLSTATE_NOT_NULL_VIOLATION.equals(sqlState)) {
      return notNullViolation(constraint, friendly);
    }
    if (SQLSTATE_CHECK_VIOLATION.equals(sqlState)) {
      return checkViolation(constraint, friendly);
    }

    String message = friendly;
    if (message == null) {
      message = "Request violates a database constraint" + suffixConstraint(constraint) + ".";
    }
    return new DatabaseErrorTranslation(
        HttpStatus.CONFLICT, "DATA_INTEGRITY_VIOLATION", message, details(constraint));
  }

  private static DatabaseErrorTranslation uniqueViolation(String constraint, String friendly) {
    String message = friendly;
    if (message == null) {
      message = "A record with the same value already exists" + suffixConstraint(constraint) + ".";
    }
    return new DatabaseErrorTranslation(
        HttpStatus.CONFLICT, "DUPLICATE_VALUE", message, details(constraint));
  }

  private static DatabaseErrorTranslation fkViolation(String constraint, String friendly) {
    String message = friendly;
    if (message == null) {
      message = "A referenced record does not exist" + suffixConstraint(constraint) + ".";
    }
    return new DatabaseErrorTranslation(
        HttpStatus.CONFLICT, "INVALID_REFERENCE", message, details(constraint));
  }

  private static DatabaseErrorTranslation notNullViolation(String constraint, String friendly) {
    String message = friendly;
    if (message == null) {
      message = "A required field is missing" + suffixConstraint(constraint) + ".";
    }
    return new DatabaseErrorTranslation(
        HttpStatus.BAD_REQUEST, "MISSING_REQUIRED_FIELD", message, details(constraint));
  }

  private static DatabaseErrorTranslation checkViolation(String constraint, String friendly) {
    String message = friendly;
    if (message == null) {
      message = "Request violates a validation rule" + suffixConstraint(constraint) + ".";
    }
    return new DatabaseErrorTranslation(
        HttpStatus.BAD_REQUEST, "VALIDATION_RULE_VIOLATION", message, details(constraint));
  }

  private static List<ApiErrorDetail> details(String constraint) {
    if (constraint == null || constraint.isBlank()) {
      return List.of();
    }
    return List.of(new ApiErrorDetail("constraint", constraint));
  }

  private static String suffixConstraint(String constraint) {
    if (constraint == null || constraint.isBlank()) {
      return "";
    }
    return " (" + constraint + ")";
  }

  private static String extractConstraintName(SQLException sql) {
    String message = sql.getMessage();
    if (message == null || message.isBlank()) {
      return null;
    }
    Matcher matcher = CONSTRAINT_QUOTED_PATTERN.matcher(message);
    if (matcher.find()) {
      return matcher.group(1);
    }
    return null;
  }

  private static String safe(String s) {
    if (s == null || s.isBlank()) {
      return null;
    }
    return s;
  }

  private static <T extends Throwable> T unwrap(Throwable ex, Class<T> type) {
    Throwable cur = ex;
    while (cur != null) {
      if (type.isInstance(cur)) {
        return type.cast(cur);
      }
      cur = cur.getCause();
    }
    return null;
  }
}
