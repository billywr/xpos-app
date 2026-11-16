package com.blinc.xpos.modules.mpesa.domain;

import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Org;
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
@Table(name = "mpesa_config")
@Getter
@Setter
@NoArgsConstructor
public class MpesaConfig {

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

  @Enumerated(EnumType.STRING)
  @Column(name = "environment", nullable = false)
  private MpesaEnvironment environment = MpesaEnvironment.SANDBOX;

  @Column(name = "consumer_key", nullable = false)
  private String consumerKey;

  @Column(name = "consumer_secret", nullable = false)
  private String consumerSecret;

  @Column(name = "passkey", nullable = false)
  private String passkey;

  @Column(name = "shortcode", nullable = false)
  private String shortcode;

  @Column(name = "till_number")
  private String tillNumber;

  @Column(name = "stk_auto_complete", nullable = false)
  private boolean stkAutoComplete;

  @Column(name = "callback_base_url")
  private String callbackBaseUrl;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false)
  private MpesaConfigStatus status = MpesaConfigStatus.ACTIVE;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;
}
