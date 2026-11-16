package com.blinc.xpos.modules.organization.domain;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.modules.compliance.domain.TaxAgencyConfig;
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
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "branch")
@Getter
@Setter
@NoArgsConstructor
public class Branch {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "org_id", nullable = false)
  private Org org;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "business_id", nullable = false)
  private Business business;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "timezone", nullable = false)
  private String timezone;

  @Column(name = "currency", nullable = false)
  private String currency;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "address_json")
  private JsonNode addressJson;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "tax_agency_config_id")
  private TaxAgencyConfig taxAgencyConfig;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "receipt_template_id")
  private ReceiptTemplate receiptTemplate;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false)
  private StatusCommon status;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;
}
