package com.blinc.xpos.api.v1.admin.catalog;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
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

/**
 * Integration test for Item admin API and sub-resources (barcodes). Requires Postgres and valid
 * Spring profile (e.g. Testcontainers).
 */
@SpringBootTest
@AutoConfigureMockMvc
class ItemAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void createThenGetAndUpdateItem() throws Exception {
    UUID orgId = createOrg();
    UUID taxProfileId = createTaxProfile(orgId);

    String createBody =
        """
        {"name":"Coca Cola 500ml","itemType":"STOCK","taxProfileId":"%s","trackInventory":true,"active":true}
        """
            .formatted(taxProfileId);

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/items")
                    .with(user("admin").roles("ADMIN"))
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.orgId").value(orgId.toString()))
            .andExpect(jsonPath("$.name").value("Coca Cola 500ml"))
            .andExpect(jsonPath("$.itemType").value("STOCK"))
            .andExpect(jsonPath("$.taxProfileId").value(taxProfileId.toString()))
            .andExpect(jsonPath("$.trackInventory").value(true))
            .andReturn();

    String json = createResult.getResponse().getContentAsString();
    UUID itemId = UUID.fromString(objectMapper.readTree(json).get("id").asText());

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/items/" + itemId)
                .with(user("admin").roles("ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(itemId.toString()))
        .andExpect(jsonPath("$.name").value("Coca Cola 500ml"));

    String updateBody =
        """
        {"name":"Coca Cola 500ml (Updated)","itemType":"STOCK","taxProfileId":"%s","trackInventory":false,"active":true}
        """
            .formatted(taxProfileId);
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/items/" + itemId)
                .with(user("admin").roles("ADMIN"))
                .contentType(APPLICATION_JSON)
                .content(updateBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Coca Cola 500ml (Updated)"))
        .andExpect(jsonPath("$.trackInventory").value(false));
  }

  @Test
  void createItemWithImageUrlThenGetAndUpdateImageUrl() throws Exception {
    UUID orgId = createOrg();
    UUID taxProfileId = createTaxProfile(orgId);
    String imageUrl = "https://example.com/images/cola-500ml.png";

    String createBody =
        ("{\"name\":\"Tusker 500ml\",\"itemType\":\"STOCK\",\"taxProfileId\":\"%s\","
            + "\"trackInventory\":false,\"active\":true,\"imageUrl\":\"%s\"}")
            .formatted(taxProfileId, imageUrl);

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/items")
                    .with(user("admin").roles("ADMIN"))
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.name").value("Tusker 500ml"))
            .andExpect(jsonPath("$.primaryImageUrl").value(imageUrl))
            .andReturn();

    UUID itemId =
        UUID.fromString(
            objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asText());

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/items/" + itemId)
                .with(user("admin").roles("ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.primaryImageUrl").value(imageUrl));

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/items/" + itemId + "/images")
                .with(user("admin").roles("ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].url").value(imageUrl))
        .andExpect(jsonPath("$[0].isPrimary").value(true));

    String newImageUrl = "https://example.com/images/tusker-new.png";
    String updateBody =
        ("{\"name\":\"Tusker 500ml\",\"itemType\":\"STOCK\",\"taxProfileId\":\"%s\","
            + "\"trackInventory\":false,\"active\":true,\"imageUrl\":\"%s\"}")
            .formatted(taxProfileId, newImageUrl);

    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/items/" + itemId)
                .with(user("admin").roles("ADMIN"))
                .contentType(APPLICATION_JSON)
                .content(updateBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.primaryImageUrl").value(newImageUrl));

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/items/" + itemId)
                .with(user("admin").roles("ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.primaryImageUrl").value(newImageUrl));
  }

  @Test
  void listItemsIncludesPrimaryImageUrl() throws Exception {
    UUID orgId = createOrg();
    UUID taxProfileId = createTaxProfile(orgId);
    String imageUrl = "https://example.com/images/menu-item.png";
    String createBody =
        ("{\"name\":\"Chicken Wings\",\"itemType\":\"STOCK\",\"taxProfileId\":\"%s\","
            + "\"trackInventory\":false,\"active\":true,\"imageUrl\":\"%s\"}")
            .formatted(taxProfileId, imageUrl);

    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/items")
                .with(user("admin").roles("ADMIN"))
                .contentType(APPLICATION_JSON)
                .content(createBody))
        .andExpect(status().isCreated());

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/items?size=20")
                .with(user("admin").roles("ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content").isArray())
        .andExpect(jsonPath("$.content[0].name").value("Chicken Wings"))
        .andExpect(jsonPath("$.content[0].primaryImageUrl").value(imageUrl));
  }

  @Test
  void addBarcodeToListAndRemove() throws Exception {
    UUID orgId = createOrg();
    UUID itemId = createItem(orgId, "SKU-001", "Test Product");

    String barcodeBody = """
        {"barcode":"5901234123457"}
        """;
    MvcResult addResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/items/" + itemId + "/barcodes")
                    .with(user("admin").roles("ADMIN"))
                    .contentType(APPLICATION_JSON)
                    .content(barcodeBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.barcode").value("5901234123457"))
            .andReturn();
    UUID barcodeId =
        UUID.fromString(
            objectMapper.readTree(addResult.getResponse().getContentAsString()).get("id").asText());

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/items/" + itemId + "/barcodes")
                .with(user("admin").roles("ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].barcode").value("5901234123457"));

    mockMvc
        .perform(
            delete("/api/v1/admin/orgs/" + orgId + "/items/" + itemId + "/barcodes/" + barcodeId)
                .with(user("admin").roles("ADMIN")))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/items/" + itemId + "/barcodes")
                .with(user("admin").roles("ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Test Org for Item " + UUID.randomUUID()));
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

  private UUID createTaxProfile(UUID orgId) throws Exception {
    String body =
        """
        {"name":"Standard VAT","vatCategory":"STANDARD","serviceChargeRate":0,"levyRate":0}
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

  private UUID createItem(UUID orgId, String sku, String name) throws Exception {
    UUID taxProfileId = createTaxProfile(orgId);
    String body =
        """
        {"sku":"%s","name":"%s","itemType":"STOCK","taxProfileId":"%s","trackInventory":true,"active":true}
        """
            .formatted(sku, name, taxProfileId);
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
}
