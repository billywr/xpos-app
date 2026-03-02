package com.blinc.xpos.api.v1.admin.catalog;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
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
 * Integration test for ModifierOption admin API (under modifier-groups). Requires Postgres and
 * valid Spring profile (e.g. Testcontainers).
 */
@SpringBootTest
@AutoConfigureMockMvc
class ModifierOptionAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void createThenGetAndUpdateModifierOption() throws Exception {
    UUID orgId = createOrg();
    UUID groupId = createModifierGroup(orgId, "Size");

    String createBody = """
        {"name":"Large","priceDelta":50.00}
        """;

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/modifier-groups/" + groupId + "/options")
                    .with(user("admin").roles("ADMIN"))
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.modifierGroupId").value(groupId.toString()))
            .andExpect(jsonPath("$.name").value("Large"))
            .andExpect(jsonPath("$.priceDelta").value(50.0))
            .andReturn();

    String json = createResult.getResponse().getContentAsString();
    UUID optionId = UUID.fromString(objectMapper.readTree(json).get("id").asText());

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/modifier-groups/" + groupId + "/options/"
                    + optionId)
                .with(user("admin").roles("ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(optionId.toString()))
        .andExpect(jsonPath("$.name").value("Large"));

    String updateBody = """
        {"name":"Large (+50)","priceDelta":55.00}
        """;
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/modifier-groups/" + groupId + "/options/"
                    + optionId)
                .with(user("admin").roles("ADMIN"))
                .contentType(APPLICATION_JSON)
                .content(updateBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Large (+50)"))
        .andExpect(jsonPath("$.priceDelta").value(55.0));
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(new OrgCreateRequest("Test Org for ModifierOption"));
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs")
                    .with(user("admin").roles("ADMIN"))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    OrgResponse org =
        objectMapper.readValue(result.getResponse().getContentAsString(), OrgResponse.class);
    return org.id();
  }

  private UUID createModifierGroup(UUID orgId, String name) throws Exception {
    String body =
        """
        {"name":"%s","minSelect":0,"maxSelect":1,"required":false}
        """
            .formatted(name);
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/modifier-groups")
                    .with(user("admin").roles("ADMIN"))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }
}
