package com.blinc.xpos.modules.mpesa.util;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class MpesaDarajaDefaultsTest {

  @Test
  void encodeStkPasswordMatchesDarajaFormat() {
    String password =
        MpesaDarajaDefaults.encodeStkPassword(
            "174379",
            "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
            "20260611124519");
    assertEquals(
        "MTc0Mzc5YmZiMjc5ZjlhYTliZGJjZjE1OGU5N2RkNzFhNDY3Y2QyZTBjODkzMDU5YjEwZjc4ZTZiNzJhZGExZWQyYzkxOTIwMjYwNjExMTI0NTE5",
        password);
  }
}
