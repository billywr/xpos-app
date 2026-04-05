package com.blinc.xpos.api.v1.operator;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static com.blinc.xpos.TestJwtFactory.operatorJwt;
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

/**
 * Integration test for Table operator API: list tables by branch. Requires Postgres (e.g.
 * Testcontainers). Uses JWT mock with subject "admin" for operator calls.
 */
@SpringBootTest
@AutoConfigureMockMvc
class TableOperatorControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void listTablesReturnsEmptyArrayWhenNoTablesExist() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    String url = "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/tables";

    mockMvc
        .perform(get(url).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$").isArray())
        .andExpect(jsonPath("$.length()").value(0));
  }

  @Test
  void listTablesReturnsTablesWhenBranchHasTables() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    createTable(orgId, branchId, null, "Table 1", 4);

    String url = "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/tables";

    mockMvc
        .perform(get(url).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$").isArray())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].id").exists())
        .andExpect(jsonPath("$[0].name").value("Table 1"))
        .andExpect(jsonPath("$[0].capacity").value(4))
        .andExpect(jsonPath("$[0].status").exists());
  }

  private void createTable(
      UUID orgId, UUID branchId, UUID tableAreaId, String name, Integer capacity) throws Exception {
    String body =
        """
        {"tableAreaId":%s,"name":"%s","capacity":%s}
        """
            .formatted(
                tableAreaId != null ? "\"" + tableAreaId + "\"" : "null",
                name,
                capacity != null ? capacity : "null");
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/branches/" + branchId + "/tables")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Test Org for Tables " + UUID.randomUUID()));
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

  private UUID createBusiness(UUID orgId) throws Exception {
    String body = """
        {"legalName":"Test Business"}
        """;
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/businesses")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createBranch(UUID orgId, UUID businessId) throws Exception {
    String body =
        """
        {"businessId":"%s","name":"Main Branch","timezone":"Africa/Nairobi","currency":"KES"}
        """
            .formatted(businessId);
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/branches")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createStaffUser(UUID orgId) throws Exception {
    String body = """
        {"iamUserId":"operator","username":"operator"}
        """;
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/staff-users")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private void assignStaffToBranch(UUID orgId, UUID staffUserId, UUID branchId) throws Exception {
    String body = """
        {"branchId":"%s","primary":true}
        """.formatted(branchId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/staff-users/" + staffUserId + "/branches")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }
}
