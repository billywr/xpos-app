package com.blinc.xpos.modules.mpesa.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.blinc.xpos.common.error.BadRequestException;
import org.junit.jupiter.api.Test;

class MpesaPhoneNormalizerTest {

  @Test
  void normalizesLocalFormat() {
    assertEquals("254712345678", MpesaPhoneNormalizer.normalize("0712345678"));
  }

  @Test
  void normalizesInternationalFormat() {
    assertEquals("254712345678", MpesaPhoneNormalizer.normalize("254712345678"));
  }

  @Test
  void normalizesNineDigitWithoutPrefix() {
    assertEquals("254712345678", MpesaPhoneNormalizer.normalize("712345678"));
  }

  @Test
  void rejectsInvalidNumber() {
    assertThrows(BadRequestException.class, () -> MpesaPhoneNormalizer.normalize("12345"));
  }

  @Test
  void rejectsBlank() {
    assertThrows(BadRequestException.class, () -> MpesaPhoneNormalizer.normalize("  "));
  }
}
