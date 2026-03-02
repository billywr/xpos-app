package com.blinc.xpos.modules.cash.domain;

import com.blinc.xpos.common.constants.enums.DenomStage;
import com.blinc.xpos.modules.organization.domain.Org;
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
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "shift_denomination_count")
@Getter
@Setter
@NoArgsConstructor
public class ShiftDenominationCount {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "org_id", nullable = false)
  private Org org;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "shift_id", nullable = false)
  private Shift shift;

  @Enumerated(EnumType.STRING)
  @Column(name = "stage", nullable = false)
  private DenomStage stage;

  @Column(name = "denomination_value", nullable = false)
  private Integer denominationValue;

  @Column(name = "count", nullable = false)
  private Integer count;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;
}
