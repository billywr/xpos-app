package com.blinc.xpos.modules.fraud.domain;

import com.blinc.xpos.common.constants.enums.ApprovalType;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.domain.StaffUser;
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
@Table(name = "approval_event")
@Getter
@Setter
@NoArgsConstructor
public class ApprovalEvent {

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
  @JoinColumn(name = "approved_by_staff_user_id", nullable = false)
  private StaffUser approvedByStaffUser;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "requested_by_staff_user_id", nullable = false)
  private StaffUser requestedByStaffUser;

  @Enumerated(EnumType.STRING)
  @Column(name = "approval_type", nullable = false)
  private ApprovalType approvalType;

  @Column(name = "target_entity_type", nullable = false)
  private String targetEntityType;

  @Column(name = "target_entity_id", nullable = false)
  private UUID targetEntityId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "reason_code_id")
  private ReasonCode reasonCode;

  @Column(name = "approved_at", nullable = false)
  private Instant approvedAt;
}
