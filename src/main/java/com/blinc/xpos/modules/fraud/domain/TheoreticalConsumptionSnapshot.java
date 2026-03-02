package com.blinc.xpos.modules.fraud.domain;

import com.blinc.xpos.modules.catalog.domain.Item;
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
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "theoretical_consumption_snapshot")
@Getter
@Setter
@NoArgsConstructor
public class TheoreticalConsumptionSnapshot {

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

  @Column(name = "business_date", nullable = false)
  private LocalDate businessDate;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "item_id", nullable = false)
  private Item item;

  @Column(name = "theoretical_qty", nullable = false)
  private BigDecimal theoreticalQty;

  @Column(name = "actual_qty", nullable = false)
  private BigDecimal actualQty;

  @Column(name = "variance_qty", nullable = false)
  private BigDecimal varianceQty;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;
}
