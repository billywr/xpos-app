package com.blinc.xpos.modules.organization.domain;

import com.blinc.xpos.common.constants.enums.StatusCommon;
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
@Table(name = "business")
@Getter
@Setter
@NoArgsConstructor
public class Business {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "org_id", nullable = false)
  private Org org;

  @Column(name = "legal_name", nullable = false)
  private String legalName;

  @Column(name = "kra_pin")
  private String kraPin;

  @Column(name = "logo_url")
  private String logoUrl;

  @Column(name = "receipt_footer")
  private String receiptFooter;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false)
  private StatusCommon status;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;
}
