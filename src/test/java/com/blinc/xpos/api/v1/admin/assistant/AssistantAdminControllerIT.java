package com.blinc.xpos.api.v1.admin.assistant;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.blinc.xpos.AbstractIntegrationTest;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgCreateRequest;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class AssistantAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void usageReturnsSummary() throws Exception {
    UUID orgId = createOrg();
    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId + "/assistant/usage?days=7").with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.days").value(7))
        .andExpect(jsonPath("$.totalQueries").isNumber())
        .andExpect(jsonPath("$.llmTokensUsed").isNumber());
  }

  @Test
  void settingsReturnsLlmConfig() throws Exception {
    UUID orgId = createOrg();
    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId + "/assistant/settings").with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.llmEnabled").isBoolean())
        .andExpect(jsonPath("$.maxTokensPerDayPerOrg").isNumber());
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(new OrgCreateRequest("AI Admin Org " + UUID.randomUUID()));
    MvcResult result =
        mockMvc
            .perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(
                        "/api/v1/admin/orgs")
                    .with(adminJwt())
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return objectMapper
        .readValue(result.getResponse().getContentAsString(), OrgResponse.class)
        .id();
  }
}
