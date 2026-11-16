package com.blinc.xpos.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "xpos.assistant")
public class AssistantProperties {

  /** Max queries per staff user per hour (in-memory; per instance). */
  private int rateLimitPerHour = 30;

  /** Optional LLM for ambiguous intent routing (server-side only). */
  private Llm llm = new Llm();

  public int getRateLimitPerHour() {
    return rateLimitPerHour;
  }

  public void setRateLimitPerHour(int rateLimitPerHour) {
    this.rateLimitPerHour = rateLimitPerHour;
  }

  public Llm getLlm() {
    return llm;
  }

  public void setLlm(Llm llm) {
    this.llm = llm;
  }

  public static class Llm {
    private boolean enabled = false;
    private String apiKey = "";
    private String baseUrl = "https://api.openai.com/v1";
    private String model = "gpt-4o-mini";

    /** Max estimated LLM tokens per org per calendar day (0 = unlimited). */
    private int maxTokensPerDayPerOrg = 5000;

    public boolean isEnabled() {
      return enabled;
    }

    public void setEnabled(boolean enabled) {
      this.enabled = enabled;
    }

    public String getApiKey() {
      return apiKey;
    }

    public void setApiKey(String apiKey) {
      this.apiKey = apiKey;
    }

    public String getBaseUrl() {
      return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
      this.baseUrl = baseUrl;
    }

    public String getModel() {
      return model;
    }

    public void setModel(String model) {
      this.model = model;
    }

    public int getMaxTokensPerDayPerOrg() {
      return maxTokensPerDayPerOrg;
    }

    public void setMaxTokensPerDayPerOrg(int maxTokensPerDayPerOrg) {
      this.maxTokensPerDayPerOrg = maxTokensPerDayPerOrg;
    }

    public boolean isConfigured() {
      return enabled && apiKey != null && !apiKey.isBlank();
    }
  }
}
