package com.blinc.xpos.modules.auditvault.domain;

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
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "audit_vault_record")
@Getter
@Setter
@NoArgsConstructor
public class AuditVaultRecord {

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

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "terminal_id")
  private Terminal terminal;

  @Column(name = "event_type", nullable = false)
  private String eventType;

  @Column(name = "event_id", nullable = false)
  private UUID eventId;

  @Column(name = "payload_hash", nullable = false)
  private String payloadHash;

  @Column(name = "previous_hash")
  private String previousHash;

  @Column(name = "hash", nullable = false)
  private String hash;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;
}
