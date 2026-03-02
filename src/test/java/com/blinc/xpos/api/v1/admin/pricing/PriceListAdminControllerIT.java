package com.blinc.xpos.api.v1.admin.pricing;

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
 * Integration test for PriceList and PriceListItem admin API. Requires Postgres (e.g.
 * Testcontainers).
 */
@SpringBootTest
@AutoConfigureMockMvc
class PriceListAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void createPriceListThenAddItemAndList() throws Exception {
    UUID orgId = createOrg();
    String createBody = """
        {"name":"Default","priority":0,"active":true}
        """;

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-lists")
                    .with(user("admin").roles("ADMIN"))
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.orgId").value(orgId.toString()))
            .andExpect(jsonPath("$.name").value("Default"))
            .andExpect(jsonPath("$.priority").value(0))
            .andReturn();

    String json = createResult.getResponse().getContentAsString();
    UUID priceListId = UUID.fromString(objectMapper.readTree(json).get("id").asText());

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId)
                .with(user("admin").roles("ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Default"));

    UUID itemId = createItem(orgId);
    String itemBody =
        """
        {"itemId":"%s","price":99.50,"currency":"KES"}
        """
            .formatted(itemId);
    MvcResult itemResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                    .with(user("admin").roles("ADMIN"))
                    .contentType(APPLICATION_JSON)
                    .content(itemBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.priceListId").value(priceListId.toString()))
            .andExpect(jsonPath("$.itemId").value(itemId.toString()))
            .andExpect(jsonPath("$.price").value(99.5))
            .andReturn();

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(user("admin").roles("ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].price").value(99.5));

    UUID priceListItemId =
        UUID.fromString(
            objectMapper.readTree(itemResult.getResponse().getContentAsString()).get("id").asText());
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items/"
                    + priceListItemId)
                .with(user("admin").roles("ADMIN")))
        .andExpect(status().isOk());

    String updateListBody = """
        {"name":"Default Retail","priority":1,"active":true}
        """;
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId)
                .with(user("admin").roles("ADMIN"))
                .contentType(APPLICATION_JSON)
                .content(updateListBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Default Retail"));
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Test Org for Pricing " + UUID.randomUUID()));
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

  private UUID createItem(UUID orgId) throws Exception {
    UUID taxProfileId = createTaxProfile(orgId);
    String body =
        """
        {"name":"Test Product","itemType":"STOCK","taxProfileId":"%s","trackInventory":true,"active":true}
        """
            .formatted(taxProfileId);
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/items")
                    .with(user("admin").roles("ADMIN"))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createTaxProfile(UUID orgId) throws Exception {
    String body =
        """
        {"name":"VAT Standard","vatCategory":"STANDARD","serviceChargeRate":0,"levyRate":0}
        """;
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/tax-profiles")
                    .with(user("admin").roles("ADMIN"))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }
}
