package com.blinc.xpos.modules.assistant.domain;

import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.domain.StaffUser;
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
@Table(name = "assistant_query_log")
@Getter
@Setter
@NoArgsConstructor
public class AssistantQueryLog {

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

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "staff_user_id")
  private StaffUser staffUser;

  @Column(name = "request_id", nullable = false, length = 64)
  private String requestId;

  @Column(name = "intent", nullable = false, length = 64)
  private String intent;

  @Column(name = "message_preview", length = 500)
  private String messagePreview;

  @Column(name = "llm_used", nullable = false)
  private boolean llmUsed;

  @Column(name = "llm_tokens", nullable = false)
  private int llmTokens;

  @Column(name = "latency_ms", nullable = false)
  private long latencyMs;

  @Column(name = "success", nullable = false)
  private boolean success;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;
}
