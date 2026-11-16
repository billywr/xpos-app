package com.blinc.xpos.modules.sales.domain;

import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.domain.Terminal;
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
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Server-side draft for the Sales Recording screen. One row per (org, branch, terminal, staff user,
 * sale date). Persists the user's in-progress quantities so they survive hard refresh, device
 * switch, and re-login. The draft is upserted by the client and auto-deleted when the batch is
 * successfully recorded.
 */
@Entity
@Table(name = "sales_recording_draft")
@Getter
@Setter
@NoArgsConstructor
public class SalesRecordingDraft {

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

  @Column(name = "iam_user_id", nullable = false, columnDefinition = "text")
  private String iamUserId;

  @Column(name = "sale_date", nullable = false)
  private LocalDate saleDate;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "draft_json", columnDefinition = "jsonb", nullable = false)
  private String draftJson;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;
}
