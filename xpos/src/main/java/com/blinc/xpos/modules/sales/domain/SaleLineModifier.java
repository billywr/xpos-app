package com.blinc.xpos.modules.sales.domain;

import com.blinc.xpos.modules.catalog.domain.ModifierOption;
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
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "sale_line_modifier")
@Getter
@Setter
@NoArgsConstructor
public class SaleLineModifier {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "org_id", nullable = false)
  private Org org;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "sale_line_id", nullable = false)
  private SaleLine saleLine;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "modifier_option_id", nullable = false)
  private ModifierOption modifierOption;

  @Column(name = "qty", nullable = false)
  private BigDecimal qty;

  @Column(name = "price_delta", nullable = false)
  private BigDecimal priceDelta;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;
}
