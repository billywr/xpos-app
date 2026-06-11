package com.blinc.xpos.modules.mpesa.util;

public final class MpesaSecretMasker {

  private MpesaSecretMasker() {}

  public static String mask(String value) {
    if (value == null || value.isBlank()) {
      return "";
    }
    if (value.length() <= 4) {
      return "****";
    }
    return "****" + value.substring(value.length() - 4);
  }

  public static boolean isMasked(String value) {
    return value != null && value.startsWith("****");
  }
}
