package com.blinc.xpos.modules.mpesa.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record DarajaStkCallbackEnvelope(@JsonProperty("Body") DarajaStkCallbackBody body) {

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record DarajaStkCallbackBody(@JsonProperty("stkCallback") DarajaStkCallback stkCallback) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record DarajaStkCallback(
      @JsonProperty("MerchantRequestID") String merchantRequestId,
      @JsonProperty("CheckoutRequestID") String checkoutRequestId,
      @JsonProperty("ResultCode") Integer resultCode,
      @JsonProperty("ResultDesc") String resultDesc,
      @JsonProperty("CallbackMetadata") DarajaCallbackMetadata callbackMetadata) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record DarajaCallbackMetadata(@JsonProperty("Item") List<DarajaCallbackItem> items) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record DarajaCallbackItem(
      @JsonProperty("Name") String name, @JsonProperty("Value") Object value) {}
}
