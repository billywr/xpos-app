package com.blinc.xpos.modules.mpesa.service.impl;

import com.blinc.xpos.common.constants.enums.SaleStatus;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.mpesa.domain.MpesaConfig;
import com.blinc.xpos.modules.mpesa.domain.MpesaStkRequest;
import com.blinc.xpos.modules.mpesa.domain.MpesaStkStatus;
import com.blinc.xpos.modules.mpesa.dto.DarajaStkCallbackEnvelope;
import com.blinc.xpos.modules.mpesa.repository.MpesaStkRequestRepository;
import com.blinc.xpos.modules.mpesa.service.MpesaCallbackService;
import com.blinc.xpos.modules.mpesa.service.MpesaConfigService;
import com.blinc.xpos.modules.sales.domain.PaymentReference;
import com.blinc.xpos.modules.sales.domain.Sale;
import com.blinc.xpos.modules.sales.domain.Tender;
import com.blinc.xpos.modules.sales.domain.TenderType;
import com.blinc.xpos.modules.sales.repository.PaymentReferenceRepository;
import com.blinc.xpos.modules.sales.repository.TenderTypeRepository;
import com.blinc.xpos.modules.sales.service.SaleService;
import com.blinc.xpos.modules.sales.service.TenderService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MpesaCallbackServiceImpl implements MpesaCallbackService {

  private static final Logger log = LoggerFactory.getLogger(MpesaCallbackServiceImpl.class);
  private static final String MPESA_STK_CODE = "MPESA_STK";
  private static final String MPESA_RECEIPT_TYPE = "MPESA_RECEIPT";

  private final MpesaStkRequestRepository mpesaStkRequestRepository;
  private final TenderService tenderService;
  private final TenderTypeRepository tenderTypeRepository;
  private final PaymentReferenceRepository paymentReferenceRepository;
  private final SaleService saleService;
  private final MpesaConfigService mpesaConfigService;
  private final ObjectMapper objectMapper;
  private final Clock clock;

  public MpesaCallbackServiceImpl(
      MpesaStkRequestRepository mpesaStkRequestRepository,
      TenderService tenderService,
      TenderTypeRepository tenderTypeRepository,
      PaymentReferenceRepository paymentReferenceRepository,
      SaleService saleService,
      MpesaConfigService mpesaConfigService,
      ObjectMapper objectMapper,
      Clock clock) {
    this.mpesaStkRequestRepository = Objects.requireNonNull(mpesaStkRequestRepository);
    this.tenderService = Objects.requireNonNull(tenderService);
    this.tenderTypeRepository = Objects.requireNonNull(tenderTypeRepository);
    this.paymentReferenceRepository = Objects.requireNonNull(paymentReferenceRepository);
    this.saleService = Objects.requireNonNull(saleService);
    this.mpesaConfigService = Objects.requireNonNull(mpesaConfigService);
    this.objectMapper = Objects.requireNonNull(objectMapper);
    this.clock = Objects.requireNonNull(clock);
  }

  @Override
  @Transactional
  public void handleStkCallback(String rawJson) {
    DarajaStkCallbackEnvelope.DarajaStkCallback callback = parseCallback(rawJson);
    if (callback == null || callback.checkoutRequestId() == null) {
      log.warn("M-Pesa callback missing CheckoutRequestID");
      return;
    }
    MpesaStkRequest stk =
        mpesaStkRequestRepository
            .findByCheckoutRequestIdForUpdate(callback.checkoutRequestId())
            .orElse(null);
    if (stk == null) {
      log.warn("M-Pesa callback for unknown CheckoutRequestID: {}", callback.checkoutRequestId());
      return;
    }
    if (isTerminal(stk.getStatus())) {
      return;
    }
    Instant now = Instant.now(clock);
    stk.setRawCallbackJson(rawJson);
    stk.setResultCode(callback.resultCode());
    stk.setResultDesc(callback.resultDesc());
    stk.setCallbackAt(now);
    stk.setUpdatedAt(now);

    if (callback.resultCode() != null && callback.resultCode() == 0) {
      handleSuccess(stk, callback, now);
    } else {
      stk.setStatus(mapFailureStatus(callback.resultCode()));
      mpesaStkRequestRepository.save(stk);
    }
  }

  private void handleSuccess(
      MpesaStkRequest stk, DarajaStkCallbackEnvelope.DarajaStkCallback callback, Instant now) {
    Sale sale = stk.getSale();
    if (sale.getStatus() != SaleStatus.OPEN) {
      log.warn(
          "M-Pesa callback for sale {} in status {}; skipping tender",
          sale.getId(),
          sale.getStatus());
      stk.setStatus(MpesaStkStatus.FAILED);
      stk.setResultDesc("Sale is no longer open");
      mpesaStkRequestRepository.save(stk);
      return;
    }
    BigDecimal callbackAmount = extractAmount(callback);
    if (callbackAmount != null) {
      BigDecimal expected = stk.getAmount().setScale(0, RoundingMode.HALF_UP);
      BigDecimal received = callbackAmount.setScale(0, RoundingMode.HALF_UP);
      if (expected.compareTo(received) != 0) {
        log.warn(
            "M-Pesa amount mismatch for {}: expected {} got {}", stk.getId(), expected, received);
        stk.setStatus(MpesaStkStatus.FAILED);
        stk.setResultDesc("Amount mismatch");
        mpesaStkRequestRepository.save(stk);
        return;
      }
    }
    String receipt = extractReceipt(callback);
    if (receipt == null || receipt.isBlank()) {
      stk.setStatus(MpesaStkStatus.FAILED);
      stk.setResultDesc("Missing M-Pesa receipt number");
      mpesaStkRequestRepository.save(stk);
      return;
    }
    stk.setMpesaReceiptNumber(receipt);
    UUID orgId = stk.getOrg().getId();
    TenderType tenderType =
        tenderTypeRepository
            .findByOrgIdAndCode(orgId, MPESA_STK_CODE)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "TENDER_TYPE_NOT_FOUND", "M-Pesa STK tender type is not configured"));
    Tender tender =
        tenderService.addTender(
            orgId,
            sale.getId(),
            tenderType.getId(),
            stk.getAmount(),
            "KES",
            stk.getStaffUser().getId());
    PaymentReference reference = new PaymentReference();
    reference.setOrg(stk.getOrg());
    reference.setTender(tender);
    reference.setReferenceType(MPESA_RECEIPT_TYPE);
    reference.setReferenceValue(receipt);
    reference.setCreatedAt(now);
    paymentReferenceRepository.save(reference);
    stk.setTender(tender);
    stk.setStatus(MpesaStkStatus.SUCCESS);
    mpesaStkRequestRepository.save(stk);

    MpesaConfig config = mpesaConfigService.resolve(orgId, stk.getBranch().getId());
    if (mpesaConfigService.isAutoComplete(config)) {
      tryCompleteSale(orgId, sale.getId());
    }
  }

  private void tryCompleteSale(UUID orgId, UUID saleId) {
    try {
      saleService.complete(orgId, saleId);
    } catch (IllegalStateException ex) {
      log.debug("Auto-complete skipped for sale {}: {}", saleId, ex.getMessage());
    } catch (RuntimeException ex) {
      log.warn("Auto-complete failed for sale {}: {}", saleId, ex.getMessage());
    }
  }

  private DarajaStkCallbackEnvelope.DarajaStkCallback parseCallback(String rawJson) {
    try {
      DarajaStkCallbackEnvelope envelope =
          objectMapper.readValue(rawJson, DarajaStkCallbackEnvelope.class);
      return envelope.body() != null ? envelope.body().stkCallback() : null;
    } catch (Exception ex) {
      log.warn("Failed to parse M-Pesa callback JSON: {}", ex.getMessage());
      return null;
    }
  }

  private static boolean isTerminal(MpesaStkStatus status) {
    return status == MpesaStkStatus.SUCCESS
        || status == MpesaStkStatus.FAILED
        || status == MpesaStkStatus.CANCELLED
        || status == MpesaStkStatus.TIMEOUT;
  }

  private static MpesaStkStatus mapFailureStatus(Integer resultCode) {
    if (resultCode != null && resultCode == 1032) {
      return MpesaStkStatus.CANCELLED;
    }
    return MpesaStkStatus.FAILED;
  }

  private static BigDecimal extractAmount(DarajaStkCallbackEnvelope.DarajaStkCallback callback) {
    List<DarajaStkCallbackEnvelope.DarajaCallbackItem> items =
        callback.callbackMetadata() != null ? callback.callbackMetadata().items() : null;
    if (items == null) {
      return null;
    }
    for (DarajaStkCallbackEnvelope.DarajaCallbackItem item : items) {
      if ("Amount".equalsIgnoreCase(item.name()) && item.value() != null) {
        if (item.value() instanceof Number number) {
          return BigDecimal.valueOf(number.doubleValue());
        }
        return new BigDecimal(item.value().toString());
      }
    }
    return null;
  }

  private static String extractReceipt(DarajaStkCallbackEnvelope.DarajaStkCallback callback) {
    List<DarajaStkCallbackEnvelope.DarajaCallbackItem> items =
        callback.callbackMetadata() != null ? callback.callbackMetadata().items() : null;
    if (items == null) {
      return null;
    }
    for (DarajaStkCallbackEnvelope.DarajaCallbackItem item : items) {
      if ("MpesaReceiptNumber".equalsIgnoreCase(item.name()) && item.value() != null) {
        return item.value().toString();
      }
    }
    return null;
  }
}
