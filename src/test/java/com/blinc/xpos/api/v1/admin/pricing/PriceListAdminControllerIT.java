package com.blinc.xpos.api.v1.admin.pricing;

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
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierId
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":5,\"receivedUnitCost\":80.00}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(adminJwt())
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
                    .with(adminJwt())
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
            get("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId).with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Default"));
    String itemBody =
        """
        {"itemId":"%s","price":99.50,"currency":"KES"}
        """.formatted(itemId);
    MvcResult itemResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                    .with(adminJwt())
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
                .with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.content[0].price").value(99.5));

    UUID priceListItemId =
        UUID.fromString(
            objectMapper
                .readTree(itemResult.getResponse().getContentAsString())
                .get("id")
                .asText());
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/"
                    + orgId
                    + "/price-lists/"
                    + priceListId
                    + "/items/"
                    + priceListItemId)
                .with(adminJwt()))
        .andExpect(status().isOk());

    String updateListBody =
        """
        {"name":"Default Retail","priority":1,"active":true}
        """;
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId)
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(updateListBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Default Retail"));
  }

  @Test
  void permanentDeleteStockReceiptRemovesTrackedItemFromPriceList() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    String grnBody =
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierId
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":6,\"receivedUnitCost\":50.00}]}";
    MvcResult grnResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(grnBody))
            .andExpect(status().isCreated())
            .andReturn();
    UUID grnId =
        UUID.fromString(
            objectMapper.readTree(grnResult.getResponse().getContentAsString()).get("id").asText());

    MvcResult createListResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-lists")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"name\":\"Retail With Stock\",\"priority\":0,\"active\":true}"))
            .andExpect(status().isCreated())
            .andReturn();
    UUID priceListId =
        UUID.fromString(
            objectMapper
                .readTree(createListResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    String itemBody =
        """
        {"itemId":"%s","price":99.00,"currency":"KES"}
        """.formatted(itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(itemBody))
        .andExpect(status().isCreated());

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1));

    mockMvc
        .perform(
            delete("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes/" + grnId)
                .with(adminJwt()))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(0));
  }

  @Test
  void deactivateStockReceiptRemovesTrackedItemFromPriceList() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    String grnBody =
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierId
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":6,\"receivedUnitCost\":50.00}]}";
    MvcResult grnResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(grnBody))
            .andExpect(status().isCreated())
            .andReturn();
    JsonNode grnJson = objectMapper.readTree(grnResult.getResponse().getContentAsString());
    UUID grnId = UUID.fromString(grnJson.get("id").asText());
    UUID supplierFromGrn = UUID.fromString(grnJson.get("supplierId").asText());
    String receivedAtIso = grnJson.get("receivedAt").asText();

    MvcResult createListResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-lists")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(
                        "{\"name\":\"Retail Deactivate Test\",\"priority\":0,\"active\":true}"))
            .andExpect(status().isCreated())
            .andReturn();
    UUID priceListId =
        UUID.fromString(
            objectMapper
                .readTree(createListResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    String itemBody =
        """
        {"itemId":"%s","price":99.00,"currency":"KES"}
        """.formatted(itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(itemBody))
        .andExpect(status().isCreated());

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1));

    String patchBody =
        "{\"supplierId\":\""
            + supplierFromGrn
            + "\",\"receivedAt\":\""
            + receivedAtIso
            + "\",\"active\":false}";
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes/" + grnId)
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(patchBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.active").value(false));

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(0));
  }

  @Test
  void addPriceListItemWhenCatalogItemInactiveReturns400() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    String grnBody =
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierId
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":5,\"receivedUnitCost\":80.00}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(grnBody))
        .andExpect(status().isCreated());
    MvcResult createListResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-lists")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"name\":\"Retail Inactive Test\",\"priority\":0,\"active\":true}"))
            .andExpect(status().isCreated())
            .andReturn();
    UUID priceListId =
        UUID.fromString(
            objectMapper
                .readTree(createListResult.getResponse().getContentAsString())
                .get("id")
                .asText());
    deactivateItemByPatch(orgId, itemId);
    String itemBody =
        """
        {"itemId":"%s","price":99.50,"currency":"KES"}
        """.formatted(itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(itemBody))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("ITEM_INACTIVE"));
  }

  @Test
  void deactivateItemZerosDefaultSellingAndPriceListPrices() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);

    String grnBody =
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierId
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":5,\"receivedUnitCost\":80.00}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(grnBody))
        .andExpect(status().isCreated());

    MvcResult createListResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-lists")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"name\":\"Retail\",\"priority\":0,\"active\":true}"))
            .andExpect(status().isCreated())
            .andReturn();
    UUID priceListId =
        UUID.fromString(
            objectMapper
                .readTree(createListResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    String itemBody =
        """
        {"itemId":"%s","price":99.50,"currency":"KES"}
        """.formatted(itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(itemBody))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.price").value(99.5));

    patchItemBuyingPrice(orgId, itemId, 80);
    patchItemDefaultSellingPrice(orgId, itemId, 200);

    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId + "/items/" + itemId).with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.defaultSellingPrice").value(200));

    deactivateItemByPatch(orgId, itemId);

    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId + "/items/" + itemId).with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.active").value(false))
        .andExpect(jsonPath("$.defaultSellingPrice").value(0));

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(0));
  }

  @Test
  void softDeleteItemZerosDefaultSellingAndPriceListPrices() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);

    String grnBody =
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierId
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":5,\"receivedUnitCost\":80.00}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(grnBody))
        .andExpect(status().isCreated());

    MvcResult createListResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-lists")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"name\":\"Retail\",\"priority\":0,\"active\":true}"))
            .andExpect(status().isCreated())
            .andReturn();
    UUID priceListId =
        UUID.fromString(
            objectMapper
                .readTree(createListResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"itemId":"%s","price":120.00,"currency":"KES"}
                    """
                        .formatted(itemId)))
        .andExpect(status().isCreated());

    patchItemBuyingPrice(orgId, itemId, 80);
    patchItemDefaultSellingPrice(orgId, itemId, 175);

    mockMvc
        .perform(delete("/api/v1/admin/orgs/" + orgId + "/items/" + itemId).with(adminJwt()))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId + "/items/" + itemId).with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.active").value(false))
        .andExpect(jsonPath("$.defaultSellingPrice").value(0));

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(0));
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
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(createListBody))
            .andExpect(status().isCreated())
            .andReturn();
    UUID priceListId =
        UUID.fromString(
            objectMapper
                .readTree(listResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    String itemBody =
        """
        {"itemId":"%s","price":99.50,"currency":"KES"}
        """.formatted(itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt())
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
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierId
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":5,\"receivedUnitCost\":50.00}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(adminJwt())
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
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(createListBody))
            .andExpect(status().isCreated())
            .andReturn();
    UUID priceListId =
        UUID.fromString(
            objectMapper
                .readTree(listResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    String itemBodyEqual =
        """
        {"itemId":"%s","price":50.00,"currency":"KES"}
        """.formatted(itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(itemBodyEqual))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("SELLING_PRICE_BELOW_COST"))
        .andExpect(jsonPath("$.message").exists());

    String itemBodyLess =
        """
        {"itemId":"%s","price":40.00,"currency":"KES"}
        """.formatted(itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(itemBodyLess))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("SELLING_PRICE_BELOW_COST"));

    String itemBodyOk =
        """
        {"itemId":"%s","price":51.00,"currency":"KES"}
        """.formatted(itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(itemBodyOk))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.price").value(51.0));
  }

  @Test
  void addPriceListItemRejectsWhenSellingBelowCatalogBuyingPriceDespiteLowerGrnCost()
      throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);

    String grnBody =
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierId
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":5,\"receivedUnitCost\":50.00}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(grnBody))
        .andExpect(status().isCreated());

    MvcResult getItem =
        mockMvc
            .perform(get("/api/v1/admin/orgs/" + orgId + "/items/" + itemId).with(adminJwt()))
            .andExpect(status().isOk())
            .andReturn();
    ObjectNode itemNode =
        (ObjectNode) objectMapper.readTree(getItem.getResponse().getContentAsString());
    itemNode.remove("id");
    itemNode.remove("orgId");
    itemNode.remove("primaryImageUrl");
    itemNode.remove("hasPurchaseHistory");
    itemNode.remove("createdAt");
    itemNode.remove("updatedAt");
    itemNode.remove("barcode");
    itemNode.put("buyingPrice", 100);
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/items/" + itemId)
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(itemNode)))
        .andExpect(status().isOk());

    String createListBody = """
        {"name":"Default","priority":0,"active":true}
        """;
    MvcResult listResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-lists")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(createListBody))
            .andExpect(status().isCreated())
            .andReturn();
    UUID priceListId =
        UUID.fromString(
            objectMapper
                .readTree(listResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    String itemBody =
        """
        {"itemId":"%s","price":90.00,"currency":"KES"}
        """.formatted(itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(itemBody))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("SELLING_PRICE_BELOW_COST"));

    String itemBodyOk =
        """
        {"itemId":"%s","price":101.00,"currency":"KES"}
        """.formatted(itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(itemBodyOk))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.price").value(101.0));
  }

  @Test
  void addDuplicatePriceListItemReturns409() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);

    String grnBody =
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierId
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":5,\"receivedUnitCost\":80.00}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(adminJwt())
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
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(createListBody))
            .andExpect(status().isCreated())
            .andReturn();
    UUID priceListId =
        UUID.fromString(
            objectMapper
                .readTree(listResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    String itemBody =
        """
        {"itemId":"%s","price":99.50,"currency":"KES"}
        """.formatted(itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(itemBody))
        .andExpect(status().isCreated());

    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(itemBody))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("PRICE_LIST_ITEM_DUPLICATE"));
  }

  @Test
  void addPriceListItemIgnoresInactiveGrnForCostFloorUsesCatalogBuyingPrice() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);

    MvcResult grnResult = postGrn(orgId, branchId, supplierId, itemId, 5, "250.00");
    deactivateGrnFromMvcResult(orgId, grnResult);
    patchItemBuyingPrice(orgId, itemId, 60);

    MvcResult listResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-lists")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"name\":\"Default\",\"priority\":0,\"active\":true}"))
            .andExpect(status().isCreated())
            .andReturn();
    UUID priceListId =
        UUID.fromString(
            objectMapper
                .readTree(listResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"itemId\":\"" + itemId + "\",\"price\":55.00,\"currency\":\"KES\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("SELLING_PRICE_BELOW_COST"));

    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"itemId\":\"" + itemId + "\",\"price\":61.00,\"currency\":\"KES\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.price").value(61.0));
  }

  @Test
  void addPriceListItemNotSuppliedWhenOnlyInactiveGrnAndNoCatalogBuying() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);

    MvcResult grnResult = postGrn(orgId, branchId, supplierId, itemId, 5, "80.00");
    deactivateGrnFromMvcResult(orgId, grnResult);

    MvcResult listResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-lists")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"name\":\"Default\",\"priority\":0,\"active\":true}"))
            .andExpect(status().isCreated())
            .andReturn();
    UUID priceListId =
        UUID.fromString(
            objectMapper
                .readTree(listResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"itemId\":\"" + itemId + "\",\"price\":99.50,\"currency\":\"KES\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("ITEM_NOT_SUPPLIED"));
  }

  private MvcResult postGrn(
      UUID orgId, UUID branchId, UUID supplierId, UUID itemId, int qty, String receivedUnitCost)
      throws Exception {
    String grnBody =
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierId
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":"
            + qty
            + ",\"receivedUnitCost\":"
            + receivedUnitCost
            + "}]}";
    return mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(grnBody))
        .andExpect(status().isCreated())
        .andReturn();
  }

  private void deactivateGrnFromMvcResult(UUID orgId, MvcResult grnCreateResult) throws Exception {
    JsonNode grnJson = objectMapper.readTree(grnCreateResult.getResponse().getContentAsString());
    UUID grnId = UUID.fromString(grnJson.get("id").asText());
    String receivedAt = grnJson.get("receivedAt").asText();
    String supplierIdStr = grnJson.get("supplierId").asText();
    String deactivateBody =
        "{\"supplierId\":\""
            + supplierIdStr
            + "\",\"receivedAt\":\""
            + receivedAt
            + "\",\"active\":false}";
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes/" + grnId)
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(deactivateBody))
        .andExpect(status().isOk());
  }

  private void patchItemDefaultSellingPrice(UUID orgId, UUID itemId, int defaultSellingPrice)
      throws Exception {
    MvcResult getItem =
        mockMvc
            .perform(get("/api/v1/admin/orgs/" + orgId + "/items/" + itemId).with(adminJwt()))
            .andExpect(status().isOk())
            .andReturn();
    ObjectNode itemNode =
        (ObjectNode) objectMapper.readTree(getItem.getResponse().getContentAsString());
    itemNode.remove("id");
    itemNode.remove("orgId");
    itemNode.remove("primaryImageUrl");
    itemNode.remove("hasPurchaseHistory");
    itemNode.remove("createdAt");
    itemNode.remove("updatedAt");
    itemNode.remove("barcode");
    itemNode.put("defaultSellingPrice", defaultSellingPrice);
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/items/" + itemId)
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(itemNode)))
        .andExpect(status().isOk());
  }

  private void deactivateItemByPatch(UUID orgId, UUID itemId) throws Exception {
    MvcResult getItem =
        mockMvc
            .perform(get("/api/v1/admin/orgs/" + orgId + "/items/" + itemId).with(adminJwt()))
            .andExpect(status().isOk())
            .andReturn();
    ObjectNode itemNode =
        (ObjectNode) objectMapper.readTree(getItem.getResponse().getContentAsString());
    itemNode.remove("id");
    itemNode.remove("orgId");
    itemNode.remove("primaryImageUrl");
    itemNode.remove("hasPurchaseHistory");
    itemNode.remove("createdAt");
    itemNode.remove("updatedAt");
    itemNode.remove("barcode");
    itemNode.put("active", false);
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/items/" + itemId)
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(itemNode)))
        .andExpect(status().isOk());
  }

  private void patchItemBuyingPrice(UUID orgId, UUID itemId, int buyingPrice) throws Exception {
    MvcResult getItem =
        mockMvc
            .perform(get("/api/v1/admin/orgs/" + orgId + "/items/" + itemId).with(adminJwt()))
            .andExpect(status().isOk())
            .andReturn();
    ObjectNode itemNode =
        (ObjectNode) objectMapper.readTree(getItem.getResponse().getContentAsString());
    itemNode.remove("id");
    itemNode.remove("orgId");
    itemNode.remove("primaryImageUrl");
    itemNode.remove("hasPurchaseHistory");
    itemNode.remove("createdAt");
    itemNode.remove("updatedAt");
    itemNode.remove("barcode");
    itemNode.put("buyingPrice", buyingPrice);
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/items/" + itemId)
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(itemNode)))
        .andExpect(status().isOk());
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Test Org for Pricing " + UUID.randomUUID()));
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

  private UUID createBusiness(UUID orgId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/businesses")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"legalName\":\"Biz\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createBranch(UUID orgId, UUID businessId) throws Exception {
    String body =
        "{\"businessId\":\""
            + businessId
            + "\",\"name\":\"Main\","
            + "\"timezone\":\"Africa/Nairobi\",\"currency\":\"KES\"}";
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/branches")
                    .with(adminJwt())
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
                    .with(adminJwt())
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
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"branchId\":\"" + branchId + "\",\"primary\":true}"))
        .andExpect(status().isCreated());
  }

  private UUID createSupplier(UUID orgId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/suppliers")
                    .with(adminJwt())
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
                    .with(adminJwt())
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
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }
}
