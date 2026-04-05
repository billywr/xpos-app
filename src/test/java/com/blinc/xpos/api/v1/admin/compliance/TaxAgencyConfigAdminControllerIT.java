package com.blinc.xpos.api.v1.admin.compliance;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
class TaxAgencyConfigAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void createThenGetAndListTaxAgencyConfigs() throws Exception {
    UUID orgId = createOrg();
    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/tax-agency-configs")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(
                        "{\"name\":\"KRA\",\"vatStandardRate\":0.16,\"vatReducedRate\":0.08,"
                            + "\"supportsEtims\":true}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.name").value("KRA"))
            .andExpect(jsonPath("$.supportsEtims").value(true))
            .andReturn();
    UUID configId =
        UUID.fromString(
            objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .get("id")
                .asText());
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/tax-agency-configs/" + configId).with(adminJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/tax-agency-configs?page=0&size=10")
                .with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1));
  }

  private UUID createOrg() throws Exception {
    String body = objectMapper.writeValueAsString(new OrgCreateRequest("Test Org TaxAgency"));
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return objectMapper
        .readValue(result.getResponse().getContentAsString(), OrgResponse.class)
        .id();
  }
}
