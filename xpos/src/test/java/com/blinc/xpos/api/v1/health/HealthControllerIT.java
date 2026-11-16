package com.blinc.xpos.api.v1.health;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.blinc.xpos.AbstractIntegrationTest;
import com.blinc.xpos.common.constants.HeaderNames;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class HealthControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;

  @Test
  void pingShouldReturnOkAndRequestIdHeader() throws Exception {
    mockMvc
        .perform(get("/api/v1/health/ping"))
        .andExpect(status().isOk())
        .andExpect(header().exists(HeaderNames.REQUEST_ID));
  }

  @Test
  void pingShouldPropagateProvidedRequestId() throws Exception {
    String rid = "test-rid-123";
    mockMvc
        .perform(get("/api/v1/health/ping").header(HeaderNames.REQUEST_ID, rid))
        .andExpect(status().isOk())
        .andExpect(header().string(HeaderNames.REQUEST_ID, rid));
  }
}
