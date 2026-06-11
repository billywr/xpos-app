package com.blinc.xpos.modules.mpesa.util;

import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.config.MpesaProperties;
import com.blinc.xpos.modules.mpesa.domain.MpesaConfig;

/**
 * Resolves Daraja OAuth credentials. When {@code xpos.mpesa.consumer-key} and {@code
 * consumer-secret} are set in application config, they override values stored in {@code
 * mpesa_config} (intended for local dev).
 */
public final class MpesaDarajaCredentials {

  public enum Source {
    APPLICATION_CONFIG,
    DATABASE
  }

  public record Resolved(String consumerKey, String consumerSecret, Source source) {}

  private MpesaDarajaCredentials() {}

  public static Resolved resolve(MpesaProperties mpesaProperties, MpesaConfig config) {
    if (hasApplicationConfigCredentials(mpesaProperties)) {
      return new Resolved(
          mpesaProperties.getConsumerKey().trim(),
          mpesaProperties.getConsumerSecret().trim(),
          Source.APPLICATION_CONFIG);
    }
    return new Resolved(
        requireNonBlank(config.getConsumerKey(), "consumer key"),
        requireNonBlank(config.getConsumerSecret(), "consumer secret"),
        Source.DATABASE);
  }

  public static boolean hasApplicationConfigCredentials(MpesaProperties mpesaProperties) {
    return mpesaProperties.getConsumerKey() != null
        && !mpesaProperties.getConsumerKey().isBlank()
        && mpesaProperties.getConsumerSecret() != null
        && !mpesaProperties.getConsumerSecret().isBlank();
  }

  private static String requireNonBlank(String value, String label) {
    if (value == null || value.isBlank()) {
      throw new BadRequestException(
          "MPESA_AUTH_FAILED",
          "M-Pesa "
              + label
              + " is missing. Set xpos.mpesa.consumer-key/consumer-secret in application config"
              + " or add credentials in Admin M-Pesa settings.");
    }
    return value.trim();
  }
}
