package com.blinc.xpos.modules.inventory.domain;

import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.domain.StaffUser;
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

@Entity
@Table(name = "stock_count_session")
@Getter
@Setter
@NoArgsConstructor
public class StockCountSession {

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

  @Column(name = "status", nullable = false)
  private String status;

  public static final String SOURCE_MANUAL = "MANUAL";
  public static final String SOURCE_SCHEDULED = "SCHEDULED";

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "started_by", nullable = false)
  private StaffUser startedBy;

  @Column(name = "started_at", nullable = false)
  private Instant startedAt;

  @Column(name = "closed_at")
  private Instant closedAt;

  @Column(name = "source_type", nullable = false)
  private String sourceType = SOURCE_MANUAL;

  @Column(name = "schedule_id")
  private UUID scheduleId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "closed_by")
  private StaffUser closedBy;

  @Column(name = "deleted_at")
  private Instant deletedAt;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "deleted_by")
  private StaffUser deletedBy;
}
