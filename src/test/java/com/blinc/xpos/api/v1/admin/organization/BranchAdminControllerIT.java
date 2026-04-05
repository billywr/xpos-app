package com.blinc.xpos.api.v1.admin.organization;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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

@SpringBootTest
@AutoConfigureMockMvc
class BranchAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void createThenGetListAndUpdateBranch() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/branches")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(
                        """
                        {"businessId":"%s","name":"Main Branch","timezone":"Africa/Nairobi","currency":"KES"}
                        """
                            .formatted(businessId)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.name").value("Main Branch"))
            .andExpect(jsonPath("$.currency").value("KES"))
            .andReturn();
    UUID branchId =
        UUID.fromString(
            objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId + "/branches?page=0&size=10").with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1));

    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId + "/branches/" + branchId).with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Main Branch"));

    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/branches/" + branchId)
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"name":"Main Branch Updated","timezone":"Africa/Nairobi","currency":"KES"}
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Main Branch Updated"));
  }

  @Test
  void deleteSoftDeletesBranchAndExcludesFromList() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/branches")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(
                        """
                        {"businessId":"%s","name":"Branch To Delete","timezone":"Africa/Nairobi","currency":"KES"}
                        """
                            .formatted(businessId)))
            .andExpect(status().isCreated())
            .andReturn();
    UUID branchId =
        UUID.fromString(
            objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    mockMvc
        .perform(delete("/api/v1/admin/orgs/" + orgId + "/branches/" + branchId).with(adminJwt()))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId + "/branches?page=0&size=100").with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[?(@.id == '%s')]", branchId.toString()).isEmpty());
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Test Org Branch IT " + UUID.randomUUID()));
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

  private UUID createBusiness(UUID orgId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/businesses")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"legalName\":\"Test Business\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }
}
