package com.blinc.xpos.modules.cash.domain;

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
@Table(name = "z_report")
@Getter
@Setter
@NoArgsConstructor
public class ZReport {

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

  @Column(name = "sales_total", nullable = false)
  private BigDecimal salesTotal;

  @Column(name = "tax_total", nullable = false)
  private BigDecimal taxTotal;

  @Column(name = "cash_total", nullable = false)
  private BigDecimal cashTotal;

  @Column(name = "mpesa_total", nullable = false)
  private BigDecimal mpesaTotal;

  @Column(name = "card_total", nullable = false)
  private BigDecimal cardTotal;

  @Column(name = "variance_total", nullable = false)
  private BigDecimal varianceTotal;

  @Column(name = "generated_at", nullable = false)
  private Instant generatedAt;

  @Column(name = "hash_snapshot")
  private String hashSnapshot;
}
