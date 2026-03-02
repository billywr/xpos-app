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
@Table(name = "terminal")
@Getter
@Setter
@NoArgsConstructor
public class Terminal {

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

  @Column(name = "terminal_code", nullable = false)
  private String terminalCode;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "device_registration_id")
  private DeviceRegistration deviceRegistration;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "printer_profile_id")
  private PrinterProfile printerProfile;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false)
  private StatusCommon status;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;
}
