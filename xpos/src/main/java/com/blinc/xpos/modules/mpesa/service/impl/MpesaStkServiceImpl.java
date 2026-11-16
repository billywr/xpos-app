package com.blinc.xpos.modules.mpesa.service.impl;

import com.blinc.xpos.common.constants.enums.SaleStatus;
import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.common.error.ConflictException;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.config.MpesaProperties;
import com.blinc.xpos.modules.mpesa.client.DarajaClient;
import com.blinc.xpos.modules.mpesa.domain.MpesaConfig;
import com.blinc.xpos.modules.mpesa.domain.MpesaStkRequest;
import com.blinc.xpos.modules.mpesa.domain.MpesaStkStatus;
import com.blinc.xpos.modules.mpesa.dto.MpesaStkInitiateRequest;
import com.blinc.xpos.modules.mpesa.dto.MpesaStkStatusResponse;
import com.blinc.xpos.modules.mpesa.repository.MpesaStkRequestRepository;
import com.blinc.xpos.modules.mpesa.service.MpesaConfigService;
import com.blinc.xpos.modules.mpesa.service.MpesaStkService;
import com.blinc.xpos.modules.mpesa.util.MpesaCallbackUrlResolver;
import com.blinc.xpos.modules.mpesa.util.MpesaPhoneNormalizer;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.domain.Terminal;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import com.blinc.xpos.modules.organization.service.TerminalService;
import com.blinc.xpos.modules.sales.domain.Sale;
import com.blinc.xpos.modules.sales.repository.SaleRepository;
import com.blinc.xpos.modules.sales.repository.TenderRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MpesaStkServiceImpl implements MpesaStkService {

  private static final int ACCOUNT_REF_LEN = 12;

  private final MpesaStkRequestRepository mpesaStkRequestRepository;
  private final SaleRepository saleRepository;
  private final TenderRepository tenderRepository;
  private final TerminalService terminalService;
  private final StaffUserService staffUserService;
  private final MpesaConfigService mpesaConfigService;
  private final DarajaClient darajaClient;
  private final MpesaProperties mpesaProperties;
  private final Clock clock;

  public MpesaStkServiceImpl(
      MpesaStkRequestRepository mpesaStkRequestRepository,
      SaleRepository saleRepository,
      TenderRepository tenderRepository,
      TerminalService terminalService,
      StaffUserService staffUserService,
      MpesaConfigService mpesaConfigService,
      DarajaClient darajaClient,
      MpesaProperties mpesaProperties,
      Clock clock) {
    this.mpesaStkRequestRepository = Objects.requireNonNull(mpesaStkRequestRepository);
    this.saleRepository = Objects.requireNonNull(saleRepository);
    this.tenderRepository = Objects.requireNonNull(tenderRepository);
    this.terminalService = Objects.requireNonNull(terminalService);
    this.staffUserService = Objects.requireNonNull(staffUserService);
    this.mpesaConfigService = Objects.requireNonNull(mpesaConfigService);
    this.darajaClient = Objects.requireNonNull(darajaClient);
    this.mpesaProperties = Objects.requireNonNull(mpesaProperties);
    this.clock = Objects.requireNonNull(clock);
  }

  @Override
  @Transactional
  public MpesaStkStatusResponse initiateStk(
      UUID orgId,
      UUID branchId,
      UUID terminalId,
      UUID saleId,
      UUID staffUserId,
      MpesaStkInitiateRequest request) {
    if (!mpesaConfigService.isStkOperatorEnabled(orgId)) {
      throw new BadRequestException(
          "MPESA_STK_DISABLED",
          "Pay by M-Pesa is disabled for this organization. Enable it in Admin Settings → M-Pesa.");
    }
    Sale sale = requireOpenSaleForTerminal(orgId, branchId, terminalId, saleId);
    if (mpesaStkRequestRepository.existsBySaleIdAndStatus(saleId, MpesaStkStatus.PENDING)) {
      throw new ConflictException(
          "MPESA_STK_ALREADY_PENDING",
          "An M-Pesa STK push is already waiting for this sale. Cancel or wait for it to finish.");
    }
    BigDecimal amount = request.amount().setScale(2, RoundingMode.HALF_UP);
    if (amount.compareTo(BigDecimal.ZERO) <= 0) {
      throw new BadRequestException("MPESA_INVALID_AMOUNT", "STK amount must be greater than zero");
    }
    BigDecimal remainder = saleRemainder(orgId, sale);
    if (amount.compareTo(remainder) > 0) {
      throw new BadRequestException(
          "MPESA_AMOUNT_EXCEEDS_REMAINDER",
          "STK amount cannot exceed remaining balance of "
              + remainder.stripTrailingZeros().toPlainString()
              + " KES");
    }
    String phone = MpesaPhoneNormalizer.normalize(request.phoneNumber());
    MpesaConfig config = mpesaConfigService.resolve(orgId, branchId);
    StaffUser staffUser = staffUserService.require(orgId, staffUserId);
    Terminal terminal = terminalService.require(orgId, terminalId);

    Instant now = Instant.now(clock);
    String accountRef = sale.getId().toString().replace("-", "").substring(0, ACCOUNT_REF_LEN);
    MpesaStkRequest stk = new MpesaStkRequest();
    stk.setOrg(sale.getOrg());
    stk.setBranch(sale.getBranch());
    stk.setTerminal(terminal);
    stk.setSale(sale);
    stk.setStaffUser(staffUser);
    stk.setAmount(amount);
    stk.setPhoneNumber(phone);
    stk.setAccountReference(accountRef);
    stk.setStatus(MpesaStkStatus.PENDING);
    stk.setCreatedAt(now);
    stk.setUpdatedAt(now);
    stk = mpesaStkRequestRepository.save(stk);

    String callbackUrl = resolveCallbackUrl(config);
    DarajaClient.DarajaStkPushResult push =
        darajaClient.initiateStkPush(config, callbackUrl, phone, amount, accountRef);
    stk.setCheckoutRequestId(push.checkoutRequestId());
    stk.setMerchantRequestId(push.merchantRequestId());
    stk.setUpdatedAt(Instant.now(clock));
    stk = mpesaStkRequestRepository.save(stk);
    return toStatusResponse(stk);
  }

  @Override
  @Transactional(readOnly = true)
  public MpesaStkStatusResponse getStatus(UUID orgId, UUID branchId, UUID stkRequestId) {
    MpesaStkRequest stk =
        mpesaStkRequestRepository
            .findByIdAndOrgId(orgId, stkRequestId)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "MPESA_STK_NOT_FOUND", "M-Pesa STK request not found: " + stkRequestId));
    if (!stk.getBranch().getId().equals(branchId)) {
      throw new NotFoundException(
          "MPESA_STK_NOT_FOUND", "M-Pesa STK request not found for this branch");
    }
    return toStatusResponse(stk);
  }

  private Sale requireOpenSaleForTerminal(UUID orgId, UUID branchId, UUID terminalId, UUID saleId) {
    Sale sale =
        saleRepository
            .findByIdAndOrgId(saleId, orgId)
            .orElseThrow(
                () -> new NotFoundException("SALE_NOT_FOUND", "Sale not found: " + saleId));
    if (sale.getStatus() != SaleStatus.OPEN) {
      throw new BadRequestException("SALE_NOT_OPEN", "Sale is not open");
    }
    if (!sale.getBranch().getId().equals(branchId)) {
      throw new NotFoundException("SALE_NOT_FOUND", "Sale not found for this branch");
    }
    if (!sale.getTerminal().getId().equals(terminalId)) {
      throw new NotFoundException("SALE_NOT_FOUND", "Sale not found for this terminal");
    }
    return sale;
  }

  private BigDecimal saleRemainder(UUID orgId, Sale sale) {
    BigDecimal tenderTotal =
        tenderRepository.findBySaleIdOrderByCapturedAtWithTenderTypeAndStaff(sale.getId()).stream()
            .map(t -> t.getAmount())
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    return sale.getTotal().subtract(tenderTotal).setScale(2, RoundingMode.HALF_UP);
  }

  private String resolveCallbackUrl(MpesaConfig config) {
    return MpesaCallbackUrlResolver.resolve(config, mpesaProperties.getCallbackUrl());
  }

  MpesaStkStatusResponse toStatusResponse(MpesaStkRequest stk) {
    Sale sale = stk.getSale();
    return new MpesaStkStatusResponse(
        stk.getId(),
        sale.getId(),
        stk.getStatus(),
        stk.getAmount(),
        stk.getPhoneNumber(),
        stk.getResultCode(),
        stk.getResultDesc(),
        stk.getMpesaReceiptNumber(),
        stk.getTender() != null ? stk.getTender().getId() : null,
        sale.getStatus().name(),
        sale.getStatus() == SaleStatus.COMPLETED,
        stk.getCreatedAt(),
        stk.getCallbackAt());
  }
}
