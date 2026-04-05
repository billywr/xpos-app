package com.blinc.xpos.api.v1.admin.organization;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static com.blinc.xpos.TestJwtFactory.noRoleJwt;
import static com.blinc.xpos.TestJwtFactory.operatorJwt;
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
import com.blinc.xpos.api.v1.admin.organization.dto.OrgUpdateRequest;
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
class OrgAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void createThenGetListAndUpdateOrg() throws Exception {
    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(new OrgCreateRequest("Test Org Phase B"))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.name").value("Test Org Phase B"))
            .andReturn();
    UUID orgId =
        objectMapper
            .readValue(createResult.getResponse().getContentAsString(), OrgResponse.class)
            .id();

    mockMvc
        .perform(get("/api/v1/admin/orgs?page=0&size=10").with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content").isArray());

    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId).with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Test Org Phase B"))
        .andExpect(jsonPath("$.status").value("ACTIVE"));

    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId)
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    objectMapper.writeValueAsString(
                        new OrgUpdateRequest("Test Org Updated", null))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Test Org Updated"));
  }

  @Test
  void getContextReturnsOrgAndAllReferenceLists() throws Exception {
    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(new OrgCreateRequest("Context Org"))))
            .andExpect(status().isCreated())
            .andReturn();
    UUID orgId =
        objectMapper
            .readValue(createResult.getResponse().getContentAsString(), OrgResponse.class)
            .id();

    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId + "/context").with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.org.id").value(orgId.toString()))
        .andExpect(jsonPath("$.org.name").value("Context Org"))
        .andExpect(jsonPath("$.businesses").isArray())
        .andExpect(jsonPath("$.branches").isArray())
        .andExpect(jsonPath("$.staffUsers").isArray())
        .andExpect(jsonPath("$.categories").isArray())
        .andExpect(jsonPath("$.taxProfiles").isArray())
        .andExpect(jsonPath("$.uoms").isArray())
        .andExpect(jsonPath("$.modifierGroups").isArray())
        .andExpect(jsonPath("$.priceLists").isArray())
        .andExpect(jsonPath("$.tenderTypes").isArray())
        .andExpect(jsonPath("$.taxAgencyConfigs").isArray())
        .andExpect(jsonPath("$.suppliers").isArray())
        .andExpect(jsonPath("$.reasonCodes").isArray())
        .andExpect(jsonPath("$.ledgerAccounts").isArray())
        .andExpect(jsonPath("$.receiptTemplates").isArray())
        .andExpect(jsonPath("$.printerProfiles").isArray())
        .andExpect(jsonPath("$.customers").isArray())
        .andExpect(jsonPath("$.approvalPolicies").isArray())
        .andExpect(jsonPath("$.postingRules").isArray())
        .andExpect(jsonPath("$.items").isArray())
        .andExpect(jsonPath("$.devices").isArray())
        .andExpect(jsonPath("$.openShifts").isArray());
  }

  @Test
  void deleteSoftDeletesOrgAndExcludesFromList() throws Exception {
    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(new OrgCreateRequest("Org To Delete"))))
            .andExpect(status().isCreated())
            .andReturn();
    UUID orgId =
        objectMapper
            .readValue(createResult.getResponse().getContentAsString(), OrgResponse.class)
            .id();

    mockMvc
        .perform(delete("/api/v1/admin/orgs/" + orgId).with(adminJwt()))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(get("/api/v1/admin/orgs?page=0&size=100").with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[?(@.id == '%s')]", orgId.toString()).isEmpty());
  }

  @Test
  void adminEndpointAllowedForOperatorRole() throws Exception {
    mockMvc.perform(get("/api/v1/admin/orgs").with(operatorJwt())).andExpect(status().isOk());
  }

  @Test
  void adminEndpointForbiddenForNoRole() throws Exception {
    mockMvc.perform(get("/api/v1/admin/orgs").with(noRoleJwt())).andExpect(status().isForbidden());
  }
}
