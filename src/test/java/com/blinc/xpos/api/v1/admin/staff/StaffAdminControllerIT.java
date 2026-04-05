package com.blinc.xpos.api.v1.admin.staff;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
class StaffAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void createStaffUserWhenIamUserIdMatchesTokenSubReturnsCreated() throws Exception {
    UUID orgId = createOrg();
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/staff-users")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"iamUserId\":\"admin\",\"username\":\"cashier1\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").exists())
        .andExpect(jsonPath("$.orgId").value(orgId.toString()))
        .andExpect(jsonPath("$.iamUserId").value("admin"))
        .andExpect(jsonPath("$.username").value("cashier1"))
        .andExpect(jsonPath("$.status").value("ACTIVE"));
  }

  @Test
  void createStaffUserWithDifferentIamUserIdSucceeds() throws Exception {
    UUID orgId = createOrg();
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/staff-users")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    "{\"iamUserId\":\"5faeb1ab-87cb-477e-acda-7e27d68e20ee\",\"username\":\"other\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.iamUserId").value("5faeb1ab-87cb-477e-acda-7e27d68e20ee"))
        .andExpect(jsonPath("$.username").value("other"));
  }

  @Test
  void deleteSoftDeletesStaffUserAndExcludesFromList() throws Exception {
    UUID orgId = createOrg();
    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/staff-users")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"iamUserId\":\"admin\",\"username\":\"staffToDelete\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    UUID staffUserId =
        UUID.fromString(
            objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    mockMvc
        .perform(
            delete("/api/v1/admin/orgs/" + orgId + "/staff-users/" + staffUserId).with(adminJwt()))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/staff-users?page=0&size=100").with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[?(@.id == '%s')]", staffUserId.toString()).isEmpty());
  }

  private UUID createOrg() throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            new OrgCreateRequest("Staff Admin Test Org " + UUID.randomUUID()))))
            .andExpect(status().isCreated())
            .andReturn();
    return objectMapper
        .readValue(result.getResponse().getContentAsString(), OrgResponse.class)
        .id();
  }
}
