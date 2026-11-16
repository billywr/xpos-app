package com.blinc.xpos.api.v1.admin.pricing;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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

/**
 * Integration test for Tax Profile admin API. Requires a running Postgres (e.g. via docker-compose
 * or Testcontainers) and valid Spring profile (e.g. dev/local) with datasource configured.
 */
@SpringBootTest
@AutoConfigureMockMvc
class TaxProfileAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void createThenGetAndUpdateTaxProfile() throws Exception {
    UUID orgId = createOrg();
    String createBody =
        """
        {"name":"Standard VAT","vatCategory":"STANDARD","serviceChargeRate":0.10,"levyRate":0.02}
        """;

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/tax-profiles")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.orgId").value(orgId.toString()))
            .andExpect(jsonPath("$.name").value("Standard VAT"))
            .andExpect(jsonPath("$.vatCategory").value("STANDARD"))
            .andExpect(jsonPath("$.serviceChargeRate").value(0.10))
            .andExpect(jsonPath("$.levyRate").value(0.02))
            .andReturn();

    String profileJson = createResult.getResponse().getContentAsString();
    UUID taxProfileId = UUID.fromString(objectMapper.readTree(profileJson).get("id").asText());

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/tax-profiles/" + taxProfileId).with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(taxProfileId.toString()))
        .andExpect(jsonPath("$.name").value("Standard VAT"));

    String updateBody =
        """
        {"name":"Standard VAT Updated","vatCategory":"REDUCED","serviceChargeRate":0.05,"levyRate":null}
        """;
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/tax-profiles/" + taxProfileId)
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(updateBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Standard VAT Updated"))
        .andExpect(jsonPath("$.vatCategory").value("REDUCED"))
        .andExpect(jsonPath("$.serviceChargeRate").value(0.05));
  }

  private UUID createOrg() throws Exception {
    String body = objectMapper.writeValueAsString(new OrgCreateRequest("Test Org for TaxProfile"));
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    OrgResponse org =
        objectMapper.readValue(result.getResponse().getContentAsString(), OrgResponse.class);
    return org.id();
  }
}
