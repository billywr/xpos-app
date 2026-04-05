package com.blinc.xpos.api.v1.admin.organization;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.blinc.xpos.AbstractIntegrationTest;
import com.blinc.xpos.api.v1.admin.organization.dto.NavVisibilityUpdateRequest;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgCreateRequest;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class NavVisibilityAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void getReturnsEmptyVisibilityForNewOrg() throws Exception {
    UUID orgId = createOrg();

    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId + "/nav-visibility").with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.admin").isEmpty())
        .andExpect(jsonPath("$.operator").isEmpty())
        .andExpect(jsonPath("$.header").isEmpty())
        .andExpect(jsonPath("$.adminLabels").isEmpty())
        .andExpect(jsonPath("$.operatorLabels").isEmpty())
        .andExpect(jsonPath("$.headerLabels").isEmpty());
  }

  @Test
  void putThenGetReturnsSavedVisibility() throws Exception {
    UUID orgId = createOrg();

    Map<String, Boolean> admin = Map.of("/admin/items", false, "/admin/suppliers", true);
    Map<String, Boolean> operator = Map.of("/operator/receipts", false);

    mockMvc
        .perform(
            put("/api/v1/admin/orgs/" + orgId + "/nav-visibility")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    objectMapper.writeValueAsString(
                        new NavVisibilityUpdateRequest(
                            admin, operator, Map.of(), Map.of(), Map.of(), Map.of()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.admin./admin/items").value(false))
        .andExpect(jsonPath("$.admin./admin/suppliers").value(true))
        .andExpect(jsonPath("$.operator./operator/receipts").value(false));

    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId + "/nav-visibility").with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.admin./admin/items").value(false))
        .andExpect(jsonPath("$.operator./operator/receipts").value(false));
  }

  @Test
  void putWithLabelsSavesAndReturnsLabels() throws Exception {
    UUID orgId = createOrg();

    Map<String, String> adminLabels =
        Map.of("/admin/items", "Products", "/admin/suppliers", "Vendors");
    Map<String, String> operatorLabels = Map.of("/operator/receipts", "Receipts History");

    mockMvc
        .perform(
            put("/api/v1/admin/orgs/" + orgId + "/nav-visibility")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    objectMapper.writeValueAsString(
                        new NavVisibilityUpdateRequest(
                            Map.of(), Map.of(), Map.of(), adminLabels, operatorLabels, Map.of()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.adminLabels./admin/items").value("Products"))
        .andExpect(jsonPath("$.adminLabels./admin/suppliers").value("Vendors"))
        .andExpect(jsonPath("$.operatorLabels./operator/receipts").value("Receipts History"));

    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId + "/nav-visibility").with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.adminLabels./admin/items").value("Products"))
        .andExpect(jsonPath("$.operatorLabels./operator/receipts").value("Receipts History"));
  }

  @Test
  void putEmptyResetsToDefaults() throws Exception {
    UUID orgId = createOrg();

    mockMvc
        .perform(
            put("/api/v1/admin/orgs/" + orgId + "/nav-visibility")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    objectMapper.writeValueAsString(
                        new NavVisibilityUpdateRequest(
                            Map.of("/admin/items", false),
                            Map.of(),
                            Map.of(),
                            Map.of(),
                            Map.of(),
                            Map.of()))))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            put("/api/v1/admin/orgs/" + orgId + "/nav-visibility")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    objectMapper.writeValueAsString(
                        new NavVisibilityUpdateRequest(
                            Map.of(), Map.of(), Map.of(), Map.of(), Map.of(), Map.of()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.admin").isEmpty())
        .andExpect(jsonPath("$.operator").isEmpty());
  }

  private UUID createOrg() throws Exception {
    String name = "NavVisOrg-" + UUID.randomUUID().toString().substring(0, 8);
    var createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(new OrgCreateRequest(name))))
            .andExpect(status().isCreated())
            .andReturn();

    return objectMapper
        .readValue(createResult.getResponse().getContentAsString(), OrgResponse.class)
        .id();
  }
}
