package com.blinc.xpos.modules.mpesa.util;

import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.modules.mpesa.domain.MpesaConfig;
import java.net.URI;
import java.util.Locale;
import java.util.Set;

public final class MpesaCallbackUrlResolver {

  public static final String CALLBACK_PATH = "/api/v1/integrations/mpesa/stk/callback";

  private static final Set<String> LOCAL_HOSTS = Set.of("localhost", "127.0.0.1", "0.0.0.0", "::1");

  private MpesaCallbackUrlResolver() {}

  public static String resolve(MpesaConfig config, String defaultCallbackUrl) {
    String url = buildUrl(config, defaultCallbackUrl);
    validateForDaraja(url);
    return url;
  }

  static String buildUrl(MpesaConfig config, String defaultCallbackUrl) {
    if (config.getCallbackBaseUrl() != null && !config.getCallbackBaseUrl().isBlank()) {
      String base = config.getCallbackBaseUrl().trim();
      if (base.endsWith(CALLBACK_PATH)) {
        return base;
      }
      return base.endsWith("/") ? base + CALLBACK_PATH.substring(1) : base + CALLBACK_PATH;
    }
    if (defaultCallbackUrl == null || defaultCallbackUrl.isBlank()) {
      return "";
    }
    return defaultCallbackUrl.trim();
  }

  public static void validateForDaraja(String url) {
    if (url == null || url.isBlank()) {
      throw invalid(
          "M-Pesa STK requires a callback URL. Set xpos.mpesa.callback-url in"
              + " application-mpesa-secrets.yml (ngrok HTTPS URL), XPOS_MPESA_CALLBACK_URL env var,"
              + " or Callback base URL in Admin M-Pesa settings.");
    }
    URI uri;
    try {
      uri = URI.create(url);
    } catch (IllegalArgumentException ex) {
      throw invalid("Callback URL is not a valid URL: " + url);
    }
    String scheme = uri.getScheme();
    if (scheme == null || !"https".equalsIgnoreCase(scheme)) {
      throw invalid(
          "Safaricom requires an HTTPS callback URL reachable from the internet. Example:"
              + " https://your-subdomain.ngrok-free.app"
              + CALLBACK_PATH);
    }
    String host = uri.getHost();
    if (host == null || isLocalHost(host)) {
      throw invalid(
          "Callback URL cannot use localhost or a private address. Expose your backend with a"
              + " public HTTPS tunnel (ngrok, Cloudflare Tunnel, etc.) and set"
              + " xpos.mpesa.callback-url or Admin Callback base URL.");
    }
    if (!url.contains(CALLBACK_PATH)) {
      throw invalid("Callback URL must end with " + CALLBACK_PATH);
    }
  }

  private static boolean isLocalHost(String host) {
    String normalized = host.toLowerCase(Locale.ROOT);
    if (LOCAL_HOSTS.contains(normalized)) {
      return true;
    }
    return normalized.endsWith(".local") || normalized.endsWith(".localhost");
  }

  private static BadRequestException invalid(String message) {
    return new BadRequestException("MPESA_INVALID_CALLBACK_URL", message);
  }
}
