package com.blinc.xpos.modules.mpesa.client;

import com.blinc.xpos.modules.mpesa.domain.MpesaConfig;
import java.math.BigDecimal;

public interface DarajaClient {

  DarajaStkPushResult initiateStkPush(
      MpesaConfig config, String callbackUrl, String phone, BigDecimal amount, String accountRef);

  /** Calls Daraja OAuth with stored credentials; throws {@code BadRequestException} on failure. */
  void verifyOAuth(MpesaConfig config);

  void invalidateOAuthCache(java.util.UUID configId);

  record DarajaStkPushResult(
      String merchantRequestId,
      String checkoutRequestId,
      String responseCode,
      String responseDesc) {}
}
