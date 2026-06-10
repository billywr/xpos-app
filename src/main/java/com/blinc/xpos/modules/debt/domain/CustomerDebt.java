package com.blinc.xpos.modules.debt.domain;

import com.blinc.xpos.common.constants.enums.CustomerDebtStatus;
import com.blinc.xpos.modules.cash.domain.Shift;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Customer;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.domain.Terminal;
import com.blinc.xpos.modules.sales.domain.Sale;
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

@Entity
@Table(name = "customer_debt")
@Getter
@Setter
@NoArgsConstructor
public class CustomerDebt {

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
  @JoinColumn(name = "customer_id", nullable = false)
  private Customer customer;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "sale_id")
  private Sale sale;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "terminal_id")
  private Terminal terminal;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "shift_id")
  private Shift shift;

  @Column(name = "amount", nullable = false)
  private BigDecimal amount;

  @Column(name = "amount_settled", nullable = false)
  private BigDecimal amountSettled;

  @Column(name = "currency", nullable = false)
  private String currency;

  @Column(name = "due_date")
  private LocalDate dueDate;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false)
  private CustomerDebtStatus status;

  @Column(name = "notes")
  private String notes;

  @Column(name = "issued_by", length = 255)
  private String issuedBy;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "created_by", nullable = false)
  private StaffUser createdBy;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "cancelled_at")
  private Instant cancelledAt;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "cancelled_by")
  private StaffUser cancelledBy;
}
