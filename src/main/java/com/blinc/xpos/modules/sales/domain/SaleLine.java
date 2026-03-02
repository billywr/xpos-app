package com.blinc.xpos.modules.sales.domain;

import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.domain.Uom;
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
@Table(name = "sale_line")
@Getter
@Setter
@NoArgsConstructor
public class SaleLine {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "org_id", nullable = false)
  private Org org;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "sale_id", nullable = false)
  private Sale sale;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "item_id", nullable = false)
  private Item item;

  @Column(name = "qty", nullable = false)
  private BigDecimal qty;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "uom_id")
  private Uom uom;

  @Column(name = "unit_price", nullable = false)
  private BigDecimal unitPrice;

  @Column(name = "line_subtotal", nullable = false)
  private BigDecimal lineSubtotal;

  @Column(name = "line_total", nullable = false)
  private BigDecimal lineTotal;

  @Column(name = "routing")
  private String routing;

  @Column(name = "seat_no")
  private Integer seatNo;

  @Column(name = "course")
  private String course;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;
}
