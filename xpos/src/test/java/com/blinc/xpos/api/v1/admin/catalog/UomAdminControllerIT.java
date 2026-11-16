package com.blinc.xpos.api.v1.admin.catalog;

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
 * Integration test for UoM admin API. Requires a running Postgres (e.g. via docker-compose or
 * Testcontainers) and valid Spring profile with datasource configured.
 */
@SpringBootTest
@AutoConfigureMockMvc
class UomAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void createThenGetAndUpdateUom() throws Exception {
    UUID orgId = createOrg();
    String createBody = """
        {"name":"Kilogram","symbol":"kg"}
        """;

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/uoms")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.orgId").value(orgId.toString()))
            .andExpect(jsonPath("$.name").value("Kilogram"))
            .andExpect(jsonPath("$.symbol").value("kg"))
            .andReturn();

    String uomJson = createResult.getResponse().getContentAsString();
    UUID uomId = UUID.fromString(objectMapper.readTree(uomJson).get("id").asText());

    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId + "/uoms/" + uomId).with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(uomId.toString()))
        .andExpect(jsonPath("$.name").value("Kilogram"))
        .andExpect(jsonPath("$.symbol").value("kg"));

    String updateBody = """
        {"name":"Kilograms","symbol":"kg"}
        """;
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/uoms/" + uomId)
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(updateBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Kilograms"));
  }

  @Test
  void createUomWithoutSymbol() throws Exception {
    UUID orgId = createOrg();
    String createBody = """
        {"name":"Piece"}
        """;
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/uoms")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(createBody))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.name").value("Piece"))
        .andExpect(jsonPath("$.symbol").isEmpty());
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Test Org for UoM " + UUID.randomUUID()));
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
