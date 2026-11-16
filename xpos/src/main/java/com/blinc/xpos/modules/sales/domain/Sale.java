package com.blinc.xpos.modules.sales.domain;

import com.blinc.xpos.common.constants.enums.SaleStatus;
import com.blinc.xpos.modules.cash.domain.Shift;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Customer;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.domain.Terminal;
import com.fasterxml.jackson.databind.JsonNode;
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
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "sale")
@Getter
@Setter
@NoArgsConstructor
public class Sale {

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
  @JoinColumn(name = "terminal_id", nullable = false)
  private Terminal terminal;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "shift_id")
  private Shift shift;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false)
  private SaleStatus status;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "receipt_id")
  private Receipt receipt;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "customer_id")
  private Customer customer;

  @Column(name = "subtotal", nullable = false)
  private BigDecimal subtotal;

  @Column(name = "tax_total", nullable = false)
  private BigDecimal taxTotal;

  @Column(name = "discount_total", nullable = false)
  private BigDecimal discountTotal;

  @Column(name = "service_charge_total", nullable = false)
  private BigDecimal serviceChargeTotal;

  @Column(name = "total", nullable = false)
  private BigDecimal total;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "pricing_context_json")
  private JsonNode pricingContextJson;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "created_by_staff_user_id", nullable = false)
  private StaffUser createdByStaffUser;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "completed_at")
  private Instant completedAt;

  /**
   * Business day this sale is attributed to. Usually derived from completedAt in the branch
   * timezone, but may be explicitly set (earlier) for backdated historical sales recorded via the
   * Sales Recording screen.
   */
  @Column(name = "business_date")
  private LocalDate businessDate;
}
