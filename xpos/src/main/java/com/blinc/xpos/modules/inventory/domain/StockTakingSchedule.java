package com.blinc.xpos.modules.inventory.domain;

import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Org;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Schedule for automatic stock count sessions. DAILY runs every day at scheduled time; WEEKLY runs
 * on a specific day of week (0=Sunday).
 */
@Entity
@Table(name = "stock_taking_schedule")
@Getter
@Setter
@NoArgsConstructor
public class StockTakingSchedule {

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

  @Column(name = "frequency", nullable = false)
  private String frequency;

  @Column(name = "day_of_week")
  private Integer dayOfWeek;

  @Column(name = "scheduled_hour", nullable = false)
  private Integer scheduledHour;

  @Column(name = "scheduled_minute", nullable = false)
  private Integer scheduledMinute;

  @Column(name = "is_active", nullable = false)
  private Boolean isActive;

  @Column(name = "last_run_at")
  private Instant lastRunAt;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  public static final String FREQUENCY_DAILY = "DAILY";
  public static final String FREQUENCY_WEEKLY = "WEEKLY";
}
