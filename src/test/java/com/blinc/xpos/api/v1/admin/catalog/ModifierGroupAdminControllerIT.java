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
 * Integration test for ModifierGroup admin API. Requires Postgres and valid Spring profile (e.g.
 * Testcontainers).
 */
@SpringBootTest
@AutoConfigureMockMvc
class ModifierGroupAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void createThenGetAndUpdateModifierGroup() throws Exception {
    UUID orgId = createOrg();
    String createBody =
        """
        {"name":"Size","minSelect":0,"maxSelect":1,"required":false}
        """;

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/modifier-groups")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.orgId").value(orgId.toString()))
            .andExpect(jsonPath("$.name").value("Size"))
            .andExpect(jsonPath("$.minSelect").value(0))
            .andExpect(jsonPath("$.maxSelect").value(1))
            .andExpect(jsonPath("$.required").value(false))
            .andReturn();

    String json = createResult.getResponse().getContentAsString();
    UUID groupId = UUID.fromString(objectMapper.readTree(json).get("id").asText());

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/modifier-groups/" + groupId).with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(groupId.toString()))
        .andExpect(jsonPath("$.name").value("Size"));

    String updateBody =
        """
        {"name":"Portion Size","minSelect":1,"maxSelect":2,"required":true}
        """;
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/modifier-groups/" + groupId)
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(updateBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Portion Size"))
        .andExpect(jsonPath("$.required").value(true));
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(new OrgCreateRequest("Test Org for ModifierGroup"));
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
