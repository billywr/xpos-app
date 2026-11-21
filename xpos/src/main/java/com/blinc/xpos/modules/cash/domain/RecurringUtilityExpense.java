package com.blinc.xpos.modules.cash.domain;

import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "recurring_utility_expense")
@Getter
@Setter
@NoArgsConstructor
public class RecurringUtilityExpense {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "org_id", nullable = false)
  private Org org;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "branch_id", nullable = false)
  private Branch branch;

  @Column(name = "name", nullable = false, length = 150)
  private String name;

  @Column(name = "amount", nullable = false)
  private BigDecimal amount;

  @Column(name = "effective_from", nullable = false)
  private LocalDate effectiveFrom;

  @Column(name = "effective_to")
  private LocalDate effectiveTo;

  @Enumerated(EnumType.STRING)
  @Column(name = "apply_timing", nullable = false, columnDefinition = "text")
  private RecurringUtilityApplyTiming applyTiming = RecurringUtilityApplyTiming.BEGINNING_OF_MONTH;

  @Column(name = "due_day_of_month", nullable = false)
  private Integer dueDayOfMonth = 1;

  @Column(name = "payee", length = 255)
  private String payee;

  @Column(name = "account_number", length = 100)
  private String accountNumber;

  @Column(name = "incurred_by", length = 150)
  private String incurredBy;

  @Column(name = "notes")
  private String notes;

  @Column(name = "active", nullable = false)
  private boolean active = true;

  @Column(name = "deleted_at")
  private Instant deletedAt;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "created_by", nullable = false)
  private StaffUser createdBy;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @PrePersist
  public void onPrePersist() {
    Instant now = Instant.now();
    if (this.createdAt == null) {
      this.createdAt = now;
    }
    if (this.updatedAt == null) {
      this.updatedAt = now;
    }
    if (this.applyTiming == null) {
      this.applyTiming = RecurringUtilityApplyTiming.BEGINNING_OF_MONTH;
    }
    if (this.dueDayOfMonth == null) {
      this.dueDayOfMonth = 1;
    }
    if (this.effectiveFrom == null) {
      this.effectiveFrom = LocalDate.now().withDayOfMonth(1);
    }
  }

  @PostLoad
  public void onPostLoad() {
    if (this.effectiveFrom == null) {
      this.effectiveFrom =
          this.createdAt != null
              ? this.createdAt.atZone(ZoneOffset.UTC).toLocalDate().withDayOfMonth(1)
              : LocalDate.now().withDayOfMonth(1);
    }
  }

  @PreUpdate
  public void onPreUpdate() {
    this.updatedAt = Instant.now();
  }
}
