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
 * Integration test for Category admin API. Requires a running Postgres (e.g. via docker-compose or
 * Testcontainers) and valid Spring profile with datasource configured.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CategoryAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void createThenGetAndUpdateCategory() throws Exception {
    UUID orgId = createOrg();
    String createBody = """
        {"name":"Beverages","type":"PRODUCT"}
        """;

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/categories")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.orgId").value(orgId.toString()))
            .andExpect(jsonPath("$.name").value("Beverages"))
            .andExpect(jsonPath("$.type").value("PRODUCT"))
            .andReturn();

    String categoryJson = createResult.getResponse().getContentAsString();
    UUID categoryId = UUID.fromString(objectMapper.readTree(categoryJson).get("id").asText());

    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId + "/categories/" + categoryId).with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(categoryId.toString()))
        .andExpect(jsonPath("$.name").value("Beverages"));

    String updateBody = """
        {"name":"Beverages & Drinks","type":"PRODUCT"}
        """;
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/categories/" + categoryId)
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(updateBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Beverages & Drinks"));
  }

  @Test
  void createChildCategory() throws Exception {
    UUID orgId = createOrg();
    String rootBody = """
        {"name":"Food","type":"PRODUCT"}
        """;
    MvcResult rootResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/categories")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(rootBody))
            .andExpect(status().isCreated())
            .andReturn();
    UUID parentId =
        UUID.fromString(
            objectMapper
                .readTree(rootResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    String childBody =
        "{\"parentId\":\"" + parentId + "\",\"name\":\"Snacks\",\"type\":\"PRODUCT\"}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/categories")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(childBody))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.parentId").value(parentId.toString()))
        .andExpect(jsonPath("$.name").value("Snacks"));
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Test Org for Category " + UUID.randomUUID()));
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
