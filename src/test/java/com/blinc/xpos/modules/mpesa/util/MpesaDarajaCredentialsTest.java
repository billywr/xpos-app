package com.blinc.xpos.modules.mpesa.util;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.blinc.xpos.config.MpesaProperties;
import com.blinc.xpos.modules.mpesa.domain.MpesaConfig;
import org.junit.jupiter.api.Test;

class MpesaDarajaCredentialsTest {

  @Test
  void applicationConfigOverridesDatabase() {
    MpesaProperties properties = new MpesaProperties();
    properties.setConsumerKey("yaml-key");
    properties.setConsumerSecret("yaml-secret");

    MpesaConfig config = new MpesaConfig();
    config.setConsumerKey("db-key");
    config.setConsumerSecret("db-secret");

    MpesaDarajaCredentials.Resolved resolved = MpesaDarajaCredentials.resolve(properties, config);
    assertEquals("yaml-key", resolved.consumerKey());
    assertEquals("yaml-secret", resolved.consumerSecret());
    assertEquals(MpesaDarajaCredentials.Source.APPLICATION_CONFIG, resolved.source());
  }

  @Test
  void fallsBackToDatabaseWhenYamlBlank() {
    MpesaProperties properties = new MpesaProperties();
    MpesaConfig config = new MpesaConfig();
    config.setConsumerKey("db-key");
    config.setConsumerSecret("db-secret");

    MpesaDarajaCredentials.Resolved resolved = MpesaDarajaCredentials.resolve(properties, config);
    assertEquals("db-key", resolved.consumerKey());
    assertEquals(MpesaDarajaCredentials.Source.DATABASE, resolved.source());
  }
}
