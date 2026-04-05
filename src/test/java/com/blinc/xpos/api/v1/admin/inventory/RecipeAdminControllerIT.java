package com.blinc.xpos.api.v1.admin.inventory;

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

@SpringBootTest
@AutoConfigureMockMvc
class RecipeAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void createRecipeAddLineUpdateAndList() throws Exception {
    UUID orgId = createOrg();
    UUID taxProfileId = createTaxProfile(orgId);
    UUID menuItemId = createItem(orgId, "Menu Item", taxProfileId);
    UUID ingredientId = createItem(orgId, "Ingredient", taxProfileId);
    String createBody = "{\"menuItemId\":\"" + menuItemId + "\",\"yieldQty\":1}";
    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/recipes")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.yieldQty").value(1))
            .andExpect(jsonPath("$.active").value(true))
            .andReturn();
    UUID recipeId =
        UUID.fromString(
            objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .get("id")
                .asText());
    String lineBody = "{\"ingredientItemId\":\"" + ingredientId + "\",\"qty\":0.5}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/recipes/" + recipeId + "/lines")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(lineBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lines.length()").value(1));
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/recipes/" + recipeId)
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"yieldQty\":2,\"active\":true}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.yieldQty").value(2));
    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId + "/recipes").with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1));
  }

  private UUID createOrg() throws Exception {
    String body = objectMapper.writeValueAsString(new OrgCreateRequest("Test Org Recipe"));
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

  private UUID createItem(UUID orgId, String name, UUID taxProfileId) throws Exception {
    String body =
        "{\"name\":\""
            + name
            + "\",\"itemType\":\"STOCK\",\"taxProfileId\":\""
            + taxProfileId
            + "\",\"trackInventory\":true,\"active\":true}";
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/items")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createTaxProfile(UUID orgId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/tax-profiles")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(
                        "{\"name\":\"VAT\",\"vatCategory\":\"STANDARD\","
                            + "\"serviceChargeRate\":0,\"levyRate\":0}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }
}
