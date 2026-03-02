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
@Table(name = "staff_profile")
@Getter
@Setter
@NoArgsConstructor
public class StaffProfile {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "org_id", nullable = false)
  private Org org;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "staff_user_id", nullable = false)
  private StaffUser staffUser;

  @Column(name = "display_name", nullable = false)
  private String displayName;

  @Column(name = "phone")
  private String phone;

  @Column(name = "email")
  private String email;

  @Column(name = "employee_no")
  private String employeeNo;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "default_branch_id")
  private Branch defaultBranch;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false)
  private StatusCommon status;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;
}
