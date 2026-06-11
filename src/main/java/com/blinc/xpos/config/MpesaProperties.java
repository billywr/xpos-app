package com.blinc.xpos.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "xpos.mpesa")
public class MpesaProperties {

  /** Public base URL Safaricom will POST STK callbacks to (must include path prefix). */
  private String callbackUrl = "http://localhost:9003/api/v1/integrations/mpesa/stk/callback";

  /** Mark PENDING STK requests as TIMEOUT after this many seconds. */
  private int stkTimeoutSeconds = 120;

  /** Cache Daraja OAuth tokens for this many seconds. */
  private int oauthTokenCacheSeconds = 3300;

  /** Optional AES key for encrypting Daraja secrets at rest (blank = store as-is). */
  private String encryptionKey = "";

  /**
   * Optional Daraja consumer key/secret from application config. When both are set, they override
   * org/branch mpesa_config credentials (local dev convenience).
   */
  private String consumerKey = "";

  private String consumerSecret = "";

  private DarajaUrls sandbox = new DarajaUrls("https://sandbox.safaricom.co.ke");
  private DarajaUrls production = new DarajaUrls("https://api.safaricom.co.ke");

  public String getCallbackUrl() {
    return callbackUrl;
  }

  public void setCallbackUrl(String callbackUrl) {
    this.callbackUrl = callbackUrl;
  }

  public int getStkTimeoutSeconds() {
    return stkTimeoutSeconds;
  }

  public void setStkTimeoutSeconds(int stkTimeoutSeconds) {
    this.stkTimeoutSeconds = stkTimeoutSeconds;
  }

  public int getOauthTokenCacheSeconds() {
    return oauthTokenCacheSeconds;
  }

  public void setOauthTokenCacheSeconds(int oauthTokenCacheSeconds) {
    this.oauthTokenCacheSeconds = oauthTokenCacheSeconds;
  }

  public String getEncryptionKey() {
    return encryptionKey;
  }

  public void setEncryptionKey(String encryptionKey) {
    this.encryptionKey = encryptionKey;
  }

  public String getConsumerKey() {
    return consumerKey;
  }

  public void setConsumerKey(String consumerKey) {
    this.consumerKey = consumerKey;
  }

  public String getConsumerSecret() {
    return consumerSecret;
  }

  public void setConsumerSecret(String consumerSecret) {
    this.consumerSecret = consumerSecret;
  }

  public DarajaUrls getSandbox() {
    return sandbox;
  }

  public void setSandbox(DarajaUrls sandbox) {
    this.sandbox = sandbox;
  }

  public DarajaUrls getProduction() {
    return production;
  }

  public void setProduction(DarajaUrls production) {
    this.production = production;
  }

  public DarajaUrls urlsFor(String environment) {
    return "PRODUCTION".equalsIgnoreCase(environment) ? production : sandbox;
  }

  public static class DarajaUrls {
    private String baseUrl;

    public DarajaUrls() {}

    public DarajaUrls(String baseUrl) {
      this.baseUrl = baseUrl;
    }

    public String getBaseUrl() {
      return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
      this.baseUrl = baseUrl;
    }

    public String oauthUrl() {
      return baseUrl + "/oauth/v1/generate?grant_type=client_credentials";
    }

    public String stkPushUrl() {
      return baseUrl + "/mpesa/stkpush/v1/processrequest";
    }

    public String stkQueryUrl() {
      return baseUrl + "/mpesa/stkpushquery/v1/query";
    }
  }
}
