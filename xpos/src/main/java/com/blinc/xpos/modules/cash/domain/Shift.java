package com.blinc.xpos.modules.cash.domain;

import com.blinc.xpos.common.constants.enums.ShiftStatus;
import com.blinc.xpos.modules.fraud.domain.ReasonCode;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.domain.Terminal;
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
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "shift")
@Getter
@Setter
@NoArgsConstructor
public class Shift {

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

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "staff_user_id", nullable = false)
  private StaffUser staffUser;

  @Column(name = "opened_at", nullable = false)
  private Instant openedAt;

  @Column(name = "closed_at")
  private Instant closedAt;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false)
  private ShiftStatus status;

  @Column(name = "opening_float_amount", nullable = false)
  private BigDecimal openingFloatAmount;

  @Column(name = "closing_counted_amount")
  private BigDecimal closingCountedAmount;

  @Column(name = "expected_cash_amount")
  private BigDecimal expectedCashAmount;

  @Column(name = "variance_amount")
  private BigDecimal varianceAmount;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "closed_by_manager_id")
  private StaffUser closedByManager;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "variance_reason_code_id")
  private ReasonCode varianceReasonCode;
}
