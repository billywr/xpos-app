package com.blinc.xpos.modules.inventory.domain;

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

/**
 * Stores closing stock counts for the Standard Stock Count Sheet (bar-style). One row per
 * (branch, item, businessDate). Opening = previous day's closing; Added = sum of IN movements.
 */
@Entity
@Table(name = "std_stock_count_snapshot")
@Getter
@Setter
@NoArgsConstructor
public class StdStockCountSnapshot {

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

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "item_id", nullable = false)
  private Item item;

  @Column(name = "business_date", nullable = false)
  private LocalDate businessDate;

  @Column(name = "closing_qty", nullable = false)
  private BigDecimal closingQty;

  @Column(name = "last_saved_at", nullable = false)
  private Instant lastSavedAt;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;
}
