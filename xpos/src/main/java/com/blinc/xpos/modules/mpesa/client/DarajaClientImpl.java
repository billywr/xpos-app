package com.blinc.xpos.modules.mpesa.client;

import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.config.MpesaProperties;
import com.blinc.xpos.modules.mpesa.domain.MpesaConfig;
import com.blinc.xpos.modules.mpesa.util.MpesaDarajaCredentials;
import com.blinc.xpos.modules.mpesa.util.MpesaDarajaDefaults;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
public class DarajaClientImpl implements DarajaClient {

  private static final Logger log = LoggerFactory.getLogger(DarajaClientImpl.class);
  private static final DateTimeFormatter TS_FMT =
      DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(ZoneId.of("Africa/Nairobi"));

  private final MpesaProperties mpesaProperties;
  private final ObjectMapper objectMapper;
  private final RestClient restClient;
  private final Clock clock;
  private final Map<String, CachedToken> tokenCache = new ConcurrentHashMap<>();

  public DarajaClientImpl(MpesaProperties mpesaProperties, ObjectMapper objectMapper, Clock clock) {
    this.mpesaProperties = Objects.requireNonNull(mpesaProperties);
    this.objectMapper = Objects.requireNonNull(objectMapper);
    this.clock = Objects.requireNonNull(clock);
    this.restClient = RestClient.create();
  }

  @Override
  public void verifyOAuth(MpesaConfig config) {
    fetchOAuthToken(config, true);
  }

  @Override
  public void invalidateOAuthCache(UUID configId) {
    if (configId != null) {
      tokenCache.remove(configId.toString());
    }
  }

  @Override
  public DarajaStkPushResult initiateStkPush(
      MpesaConfig config, String callbackUrl, String phone, BigDecimal amount, String accountRef) {
    String token = fetchOAuthToken(config, false);
    String timestamp = TS_FMT.format(Instant.now(clock));
    String shortcode = MpesaDarajaDefaults.resolveShortcode(config);
    String passkey = MpesaDarajaDefaults.resolvePasskey(config);
    String password = MpesaDarajaDefaults.encodeStkPassword(shortcode, passkey, timestamp);
    String partyB = MpesaDarajaDefaults.resolvePartyB(config, shortcode);
    String transactionType = MpesaDarajaDefaults.resolveTransactionType(config);
    String kesAmount = amount.setScale(0, RoundingMode.HALF_UP).toPlainString();
    String effectiveCallback = callbackUrl != null ? callbackUrl.trim() : "";

    Map<String, String> body = new LinkedHashMap<>();
    body.put("Password", password);
    body.put("BusinessShortCode", shortcode);
    body.put("Timestamp", timestamp);
    body.put("Amount", kesAmount);
    body.put("PartyA", phone);
    body.put("PartyB", partyB);
    body.put("TransactionType", transactionType);
    body.put("PhoneNumber", phone);
    body.put("TransactionDesc", truncate("XPOS Payment", 13));
    body.put("AccountReference", truncate(accountRef, 12));
    body.put("CallBackURL", effectiveCallback);

    String stkUrl = mpesaProperties.urlsFor(config.getEnvironment().name()).stkPushUrl();
    try {
      String responseBody =
          restClient
              .post()
              .uri(stkUrl)
              .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
              .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
              .contentType(MediaType.APPLICATION_JSON)
              .body(body)
              .retrieve()
              .body(String.class);
      JsonNode json = objectMapper.readTree(responseBody);
      String responseCode = textOrNull(json, "ResponseCode");
      if (!"0".equals(responseCode)) {
        throw new BadRequestException(
            "MPESA_STK_FAILED",
            "Safaricom rejected STK push: " + textOrNull(json, "ResponseDescription"));
      }
      return new DarajaStkPushResult(
          textOrNull(json, "MerchantRequestID"),
          textOrNull(json, "CheckoutRequestID"),
          responseCode,
          textOrNull(json, "CustomerMessage"));
    } catch (RestClientResponseException ex) {
      log.warn(
          "Daraja STK push HTTP {}: {}",
          ex.getStatusCode().value(),
          safeBody(ex.getResponseBodyAsString()));
      throw new BadRequestException(
          "MPESA_STK_FAILED",
          "Safaricom STK push failed (HTTP "
              + ex.getStatusCode().value()
              + "). "
              + safeBody(ex.getResponseBodyAsString()));
    } catch (BadRequestException ex) {
      throw ex;
    } catch (Exception ex) {
      log.warn("Daraja STK push error: {}", ex.getMessage());
      throw new BadRequestException("MPESA_STK_FAILED", "Unexpected Daraja response. Try again.");
    }
  }

  private String fetchOAuthToken(MpesaConfig config, boolean bypassCache) {
    String cacheKey = config.getId().toString();
    if (!bypassCache) {
      CachedToken cached = tokenCache.get(cacheKey);
      if (cached != null && cached.expiresAt.isAfter(Instant.now(clock))) {
        return cached.token;
      }
    }

    MpesaDarajaCredentials.Resolved credentials =
        MpesaDarajaCredentials.resolve(mpesaProperties, config);
    String consumerKey = credentials.consumerKey();
    String consumerSecret = credentials.consumerSecret();
    if (credentials.source() == MpesaDarajaCredentials.Source.APPLICATION_CONFIG) {
      log.debug("Daraja OAuth using consumer credentials from application config (xpos.mpesa.*)");
    }
    String environment = config.getEnvironment().name();
    String oauthUrl = mpesaProperties.urlsFor(environment).oauthUrl();
    String basicAuth = basicAuthHeader(consumerKey, consumerSecret);

    try {
      String responseBody =
          restClient
              .get()
              .uri(oauthUrl)
              .header(HttpHeaders.AUTHORIZATION, basicAuth)
              .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
              .retrieve()
              .body(String.class);
      JsonNode json = objectMapper.readTree(responseBody);
      String token = textOrNull(json, "access_token");
      if (token == null || token.isBlank()) {
        throw authFailed(
            environment,
            "Daraja OAuth returned no access_token for " + environment + " environment.");
      }
      int ttl = mpesaProperties.getOauthTokenCacheSeconds();
      tokenCache.put(cacheKey, new CachedToken(token, Instant.now(clock).plusSeconds(ttl)));
      return token;
    } catch (RestClientResponseException ex) {
      log.warn(
          "Daraja OAuth HTTP {} env={} url={} keyLen={} secretLen={}: {}",
          ex.getStatusCode().value(),
          environment,
          oauthUrl,
          consumerKey.length(),
          consumerSecret.length(),
          safeBody(ex.getResponseBodyAsString()));
      throw authFailed(environment, oauthFailureMessage(ex, environment));
    } catch (BadRequestException ex) {
      throw ex;
    } catch (Exception ex) {
      log.warn("Daraja OAuth error env={}: {}", environment, ex.getMessage());
      throw new BadRequestException(
          "MPESA_AUTH_FAILED", "Could not authenticate with Safaricom Daraja.");
    }
  }

  private static String basicAuthHeader(String consumerKey, String consumerSecret) {
    String credentials = consumerKey + ":" + consumerSecret;
    String encoded =
        Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
    return "Basic " + encoded;
  }

  private static BadRequestException authFailed(String environment, String message) {
    return new BadRequestException("MPESA_AUTH_FAILED", message);
  }

  private static String oauthFailureMessage(RestClientResponseException ex, String environment) {
    String body = safeBody(ex.getResponseBodyAsString());
    StringBuilder message =
        new StringBuilder(
            "Daraja OAuth failed (HTTP "
                + ex.getStatusCode().value()
                + ") for "
                + environment
                + " environment.");
    if ("PRODUCTION".equalsIgnoreCase(environment)) {
      message.append(
          " Sandbox consumer keys only work when environment is SANDBOX, not PRODUCTION.");
    } else {
      message.append(
          " Re-save consumer key and secret in Admin M-Pesa settings (re-enter the secret —"
              + " leaving it blank keeps the old value).");
    }
    message.append(
        " If this branch has an active branch override config, update that config too — it"
            + " takes priority over org default.");
    if (!body.isBlank()) {
      message.append(" ").append(body);
    }
    return message.toString();
  }

  private static String trimCredential(String value, String label) {
    if (value == null || value.isBlank()) {
      throw new BadRequestException(
          "MPESA_AUTH_FAILED", "M-Pesa " + label + " is missing in Admin Settings.");
    }
    return value.trim();
  }

  private static String truncate(String value, int maxLen) {
    if (value == null || value.isBlank()) {
      return "";
    }
    String trimmed = value.trim();
    return trimmed.length() <= maxLen ? trimmed : trimmed.substring(0, maxLen);
  }

  private static String safeBody(String body) {
    if (body == null || body.isBlank()) {
      return "";
    }
    return body.length() > 200 ? body.substring(0, 200) + "…" : body;
  }

  private static String textOrNull(JsonNode node, String field) {
    JsonNode value = node.get(field);
    return value == null || value.isNull() ? null : value.asText();
  }

  private record CachedToken(String token, Instant expiresAt) {}
}
