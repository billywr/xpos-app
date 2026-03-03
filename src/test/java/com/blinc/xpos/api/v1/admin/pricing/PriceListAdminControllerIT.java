package com.blinc.xpos.api.v1.admin.pricing;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
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
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);

    String grnBody =
        "{\"branchId\":\"" + branchId + "\",\"supplierId\":\"" + supplierId
            + "\",\"lines\":[{\"itemId\":\"" + itemId + "\",\"qty\":5,\"receivedUnitCost\":80.00}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(grnBody))
        .andExpect(status().isCreated());

    String createBody = """
        {"name":"Default","priority":0,"active":true}
        """;

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-lists")
                    .with(jwt().jwt(j -> j.subject("admin")))
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
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Default"));
    String itemBody =
        """
        {"itemId":"%s","price":99.50,"currency":"KES"}
        """
            .formatted(itemId);
    MvcResult itemResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                    .with(jwt().jwt(j -> j.subject("admin")))
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
                .with(jwt().jwt(j -> j.subject("admin"))))
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
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk());

    String updateListBody = """
        {"name":"Default Retail","priority":1,"active":true}
        """;
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId)
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(updateListBody))
        .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Default Retail"));
  }

  @Test
  void addPriceListItemWithItemNotSuppliedRejects() throws Exception {
    UUID orgId = createOrg();
    UUID itemId = createItem(orgId);

    String createListBody = """
        {"name":"Default","priority":0,"active":true}
        """;
    MvcResult listResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-lists")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(createListBody))
            .andExpect(status().isCreated())
            .andReturn();
    UUID priceListId =
        UUID.fromString(
            objectMapper.readTree(listResult.getResponse().getContentAsString()).get("id").asText());

    String itemBody =
        """
        {"itemId":"%s","price":99.50,"currency":"KES"}
        """
            .formatted(itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(itemBody))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("ITEM_NOT_SUPPLIED"))
        .andExpect(jsonPath("$.message").exists());
  }

  @Test
  void addPriceListItemWithSellingPriceBelowCostRejects() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);

    String grnBody =
        "{\"branchId\":\"" + branchId + "\",\"supplierId\":\"" + supplierId
            + "\",\"lines\":[{\"itemId\":\"" + itemId + "\",\"qty\":5,\"receivedUnitCost\":50.00}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(grnBody))
        .andExpect(status().isCreated());

    String createListBody = """
        {"name":"Default","priority":0,"active":true}
        """;
    MvcResult listResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-lists")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(createListBody))
            .andExpect(status().isCreated())
            .andReturn();
    UUID priceListId =
        UUID.fromString(objectMapper.readTree(listResult.getResponse().getContentAsString()).get("id").asText());

    String itemBodyEqual =
        """
        {"itemId":"%s","price":50.00,"currency":"KES"}
        """
            .formatted(itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(itemBodyEqual))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("SELLING_PRICE_BELOW_COST"))
        .andExpect(jsonPath("$.message").exists());

    String itemBodyLess =
        """
        {"itemId":"%s","price":40.00,"currency":"KES"}
        """
            .formatted(itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(itemBodyLess))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("SELLING_PRICE_BELOW_COST"));

    String itemBodyOk =
        """
        {"itemId":"%s","price":51.00,"currency":"KES"}
        """
            .formatted(itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(itemBodyOk))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.price").value(51.0));
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Test Org for Pricing " + UUID.randomUUID()));
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    OrgResponse org =
        objectMapper.readValue(result.getResponse().getContentAsString(), OrgResponse.class);
    return org.id();
  }

  private UUID createBusiness(UUID orgId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/businesses")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content("{\"legalName\":\"Biz\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createBranch(UUID orgId, UUID businessId) throws Exception {
    String body =
        "{\"businessId\":\"" + businessId + "\",\"name\":\"Main\","
            + "\"timezone\":\"Africa/Nairobi\",\"currency\":\"KES\"}";
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/branches")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createStaffUser(UUID orgId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/staff-users")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content("{\"iamUserId\":\"admin\",\"username\":\"admin\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private void assignStaffToBranch(UUID orgId, UUID staffUserId, UUID branchId) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/staff-users/" + staffUserId + "/branches")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content("{\"branchId\":\"" + branchId + "\",\"primary\":true}"))
        .andExpect(status().isCreated());
  }

  private UUID createSupplier(UUID orgId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/suppliers")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content("{\"name\":\"Supplier\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
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
                    .with(jwt().jwt(j -> j.subject("admin")))
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
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }
}
