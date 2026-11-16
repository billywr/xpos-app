package com.blinc.xpos.modules.mpesa.domain;

import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.domain.Terminal;
import com.blinc.xpos.modules.sales.domain.Sale;
import com.blinc.xpos.modules.sales.domain.Tender;
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
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "mpesa_stk_request")
@Getter
@Setter
@NoArgsConstructor
public class MpesaStkRequest {

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

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "sale_id", nullable = false)
  private Sale sale;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "staff_user_id", nullable = false)
  private StaffUser staffUser;

  @Column(name = "amount", nullable = false)
  private BigDecimal amount;

  @Column(name = "phone_number", nullable = false)
  private String phoneNumber;

  @Column(name = "account_reference", nullable = false)
  private String accountReference;

  @Column(name = "checkout_request_id")
  private String checkoutRequestId;

  @Column(name = "merchant_request_id")
  private String merchantRequestId;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false)
  private MpesaStkStatus status = MpesaStkStatus.PENDING;

  @Column(name = "result_code")
  private Integer resultCode;

  @Column(name = "result_desc")
  private String resultDesc;

  @Column(name = "mpesa_receipt_number")
  private String mpesaReceiptNumber;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "tender_id")
  private Tender tender;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "raw_callback_json", columnDefinition = "jsonb")
  private String rawCallbackJson;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "callback_at")
  private Instant callbackAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;
}
