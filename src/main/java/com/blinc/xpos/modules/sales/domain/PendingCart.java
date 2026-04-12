package com.blinc.xpos.modules.sales.domain;

import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Org;
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
@Table(name = "pending_cart")
@Getter
@Setter
@NoArgsConstructor
public class PendingCart {

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

  @Column(name = "iam_user_id", nullable = false, columnDefinition = "text")
  private String iamUserId;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "cart_json", columnDefinition = "jsonb", nullable = false)
  private String cartJson;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;
}
