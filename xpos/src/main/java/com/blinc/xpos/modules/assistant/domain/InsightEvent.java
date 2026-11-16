package com.blinc.xpos.modules.assistant.domain;

import com.blinc.xpos.modules.organization.domain.Branch;
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
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "insight_event")
@Getter
@Setter
@NoArgsConstructor
public class InsightEvent {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "org_id", nullable = false)
  private Org org;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "branch_id")
  private Branch branch;

  @Column(name = "insight_type", nullable = false, length = 64)
  private String insightType;

  @Column(name = "severity", nullable = false, length = 16)
  private String severity;

  @Column(name = "title", nullable = false)
  private String title;

  @Column(name = "body", nullable = false, columnDefinition = "text")
  private String body;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "data_json")
  private JsonNode dataJson;

  @Column(name = "acknowledged_at")
  private Instant acknowledgedAt;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;
}
