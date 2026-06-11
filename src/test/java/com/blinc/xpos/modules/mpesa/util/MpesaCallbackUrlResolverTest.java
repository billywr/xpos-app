package com.blinc.xpos.modules.mpesa.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.modules.mpesa.domain.MpesaConfig;
import org.junit.jupiter.api.Test;

class MpesaCallbackUrlResolverTest {

  private static final String PUBLIC_CALLBACK =
      "https://abc123.ngrok-free.app/api/v1/integrations/mpesa/stk/callback";

  @Test
  void resolveUsesDefaultWhenConfigOverrideMissing() {
    MpesaConfig config = new MpesaConfig();
    String resolved = MpesaCallbackUrlResolver.resolve(config, PUBLIC_CALLBACK);
    assertEquals(PUBLIC_CALLBACK, resolved);
  }

  @Test
  void resolveAppendsCallbackPathToBaseOverride() {
    MpesaConfig config = new MpesaConfig();
    config.setCallbackBaseUrl("https://abc123.ngrok-free.app");
    String resolved = MpesaCallbackUrlResolver.resolve(config, PUBLIC_CALLBACK);
    assertEquals(PUBLIC_CALLBACK, resolved);
  }

  @Test
  void rejectLocalhostDefault() {
    MpesaConfig config = new MpesaConfig();
    BadRequestException ex =
        assertThrows(
            BadRequestException.class,
            () ->
                MpesaCallbackUrlResolver.resolve(
                    config, "http://localhost:9003/api/v1/integrations/mpesa/stk/callback"));
    assertEquals("MPESA_INVALID_CALLBACK_URL", ex.getCode());
  }

  @Test
  void rejectHttpPublicUrl() {
    MpesaConfig config = new MpesaConfig();
    config.setCallbackBaseUrl("http://example.com");
    BadRequestException ex =
        assertThrows(BadRequestException.class, () -> MpesaCallbackUrlResolver.resolve(config, ""));
    assertEquals("MPESA_INVALID_CALLBACK_URL", ex.getCode());
  }
}
