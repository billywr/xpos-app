package com.blinc.xpos;

import org.junit.jupiter.api.Test;

/** Minimal test that runs when integration tests are excluded (no Docker/context required). */
class SimpleSanityTest {

  @Test
  void sanity() {
    // Passes when test harness runs; integration tests are excluded by default.
  }
}
