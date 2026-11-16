package com.blinc.xpos.modules.mpesa.util;

import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.modules.mpesa.domain.MpesaConfig;
import com.blinc.xpos.modules.mpesa.domain.MpesaEnvironment;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

public final class MpesaDarajaDefaults {

  public static final String SANDBOX_SHORTCODE = "174379";

  public static final String SANDBOX_PASSKEY =
      "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";

  private MpesaDarajaDefaults() {}

  public static String resolveShortcode(MpesaConfig config) {
    if (config.getShortcode() != null && !config.getShortcode().isBlank()) {
      return config.getShortcode().trim();
    }
    if (config.getEnvironment() == MpesaEnvironment.SANDBOX) {
      return SANDBOX_SHORTCODE;
    }
    throw new BadRequestException(
        "MPESA_SHORTCODE_REQUIRED", "Business shortcode is required for production M-Pesa STK.");
  }

  /** Passkey from config, or sandbox default when environment is SANDBOX and unset. */
  public static String resolvePasskey(MpesaConfig config) {
    if (config.getPasskey() != null && !config.getPasskey().isBlank()) {
      return config.getPasskey().trim();
    }
    if (config.getEnvironment() == MpesaEnvironment.SANDBOX) {
      return SANDBOX_PASSKEY;
    }
    throw new BadRequestException(
        "MPESA_PASSKEY_REQUIRED",
        "Passkey is required for production M-Pesa STK. Add it in Admin Settings.");
  }

  /**
   * Daraja STK Password: Base64(Shortcode + Passkey + Timestamp), timestamp format YYYYMMDDHHmmss.
   */
  public static String encodeStkPassword(String shortcode, String passkey, String timestamp) {
    String raw = shortcode + passkey + timestamp;
    return Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
  }

  public static String resolveTransactionType(MpesaConfig config) {
    if (config.getTillNumber() != null && !config.getTillNumber().isBlank()) {
      return "CustomerBuyGoodsOnline";
    }
    return "CustomerPayBillOnline";
  }

  public static String resolvePartyB(MpesaConfig config, String shortcode) {
    if (config.getTillNumber() != null && !config.getTillNumber().isBlank()) {
      return config.getTillNumber().trim();
    }
    return shortcode;
  }
}
