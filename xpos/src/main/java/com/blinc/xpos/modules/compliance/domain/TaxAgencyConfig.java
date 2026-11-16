package com.blinc.xpos.modules.compliance.domain;

import com.blinc.xpos.modules.organization.domain.Org;
import com.fasterxml.jackson.databind.JsonNode;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "tax_agency_config")
@Getter
@Setter
@NoArgsConstructor
public class TaxAgencyConfig {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "org_id", nullable = false)
  private Org org;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "vat_standard_rate", nullable = false)
  private BigDecimal vatStandardRate;

  @Column(name = "vat_reduced_rate", nullable = false)
  private BigDecimal vatReducedRate;

  @Column(name = "supports_etims", nullable = false)
  private Boolean supportsEtims;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "etims_mapping_json")
  private JsonNode etimsMappingJson;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;
}
