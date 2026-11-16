package com.blinc.xpos.modules.mpesa.util;

import com.blinc.xpos.common.error.BadRequestException;

public final class MpesaPhoneNormalizer {

  private MpesaPhoneNormalizer() {}

  /** Normalize Kenyan mobile to E.164 without plus: 2547XXXXXXXX. */
  public static String normalize(String raw) {
    if (raw == null || raw.isBlank()) {
      throw new BadRequestException("MPESA_INVALID_PHONE", "Phone number is required");
    }
    String digits = raw.replaceAll("[^0-9]", "");
    if (digits.startsWith("0") && digits.length() == 10) {
      digits = "254" + digits.substring(1);
    } else if (digits.startsWith("254") && digits.length() == 12) {
      // ok
    } else if (digits.startsWith("7") && digits.length() == 9) {
      digits = "254" + digits;
    } else {
      throw new BadRequestException(
          "MPESA_INVALID_PHONE", "Enter a valid Kenyan mobile number (07XXXXXXXX or 2547XXXXXXXX)");
    }
    if (!digits.matches("2547[0-9]{8}")) {
      throw new BadRequestException(
          "MPESA_INVALID_PHONE", "Enter a valid Kenyan mobile number (07XXXXXXXX or 2547XXXXXXXX)");
    }
    return digits;
  }
}
