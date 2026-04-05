package com.blinc.xpos.api.v1.operator;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static com.blinc.xpos.TestJwtFactory.operatorJwt;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.blinc.xpos.AbstractIntegrationTest;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgCreateRequest;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/** Integration test for Standard Stock Count Sheet operator API. */
@SpringBootTest
@AutoConfigureMockMvc
class StdStockCountOperatorControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;

  @Autowired private ObjectMapper objectMapper;

  @Test
  void getSheetReturnsRowsFromPriceListItems() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID priceListId = createPriceList(orgId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);
    addItemToPriceList(orgId, priceListId, itemId);

    String date = LocalDate.now().toString();
    String url =
        "/api/v1/operator/orgs/"
            + orgId
            + "/branches/"
            + branchId
            + "/std-stock-count?date="
            + date;

    mockMvc
        .perform(get(url).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.date").value(date))
        .andExpect(jsonPath("$.outletId").value(branchId.toString()))
        .andExpect(jsonPath("$.rows.length()").value(1))
        .andExpect(jsonPath("$.rows[0].itemId").value(itemId.toString()))
        .andExpect(jsonPath("$.rows[0].openingStock").value(0))
        .andExpect(jsonPath("$.rows[0].addedStock").value(5))
        .andExpect(jsonPath("$.rows[0].addedTodayStock").value(0))
        .andExpect(jsonPath("$.rows[0].systemCountBeforeToday").value(5));
  }

  @Test
  void getSheetSplitsGrnAddedAndStockTakeAddedToday() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID priceListId = createPriceList(orgId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);
    addItemToPriceList(orgId, priceListId, itemId);

    String sessionBody = "{\"branchId\":\"" + branchId + "\"}";
    MvcResult sessionResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/stock-count-sessions")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content(sessionBody))
            .andExpect(status().isCreated())
            .andReturn();
    UUID sessionId =
        UUID.fromString(
            objectMapper
                .readTree(sessionResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    String lineBody = """
        {"itemId":"%s","countedQty":8}
        """.formatted(itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/stock-count-sessions/" + sessionId + "/lines")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(lineBody))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/stock-count-sessions/" + sessionId + "/close")
                .with(operatorJwt()))
        .andExpect(status().isOk());

    String date = LocalDate.now().toString();
    String url =
        "/api/v1/operator/orgs/"
            + orgId
            + "/branches/"
            + branchId
            + "/std-stock-count?date="
            + date;

    mockMvc
        .perform(get(url).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rows[0].openingStock").value(0))
        .andExpect(jsonPath("$.rows[0].addedStock").value(5))
        .andExpect(jsonPath("$.rows[0].addedTodayStock").value(3))
        .andExpect(jsonPath("$.rows[0].systemCountBeforeToday").value(8));
  }

  @Test
  void getSheetAddedStockIsNetGrnInMinusOutAfterReceiptLineReduction() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID priceListId = createPriceList(orgId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    String grnBody =
        """
        {"branchId":"%s","supplierId":"%s","lines":[{"itemId":"%s","qty":5,"receivedUnitCost":80.00}]}
        """
            .formatted(branchId, supplierId, itemId);
    MvcResult grnResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content(grnBody))
            .andExpect(status().isCreated())
            .andReturn();
    String grnJson = grnResult.getResponse().getContentAsString();
    UUID grnId = UUID.fromString(objectMapper.readTree(grnJson).get("id").asText());
    String receivedAtForPatch = objectMapper.readTree(grnJson).get("receivedAt").asText();

    String patchBody =
        "{\"supplierId\":\""
            + supplierId
            + "\",\"receivedAt\":\""
            + receivedAtForPatch
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":2,\"receivedUnitCost\":80.00}]}";
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes/" + grnId)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(patchBody))
        .andExpect(status().isOk());

    addItemToPriceList(orgId, priceListId, itemId);

    String date = LocalDate.now().toString();
    String url =
        "/api/v1/operator/orgs/"
            + orgId
            + "/branches/"
            + branchId
            + "/std-stock-count?date="
            + date;

    mockMvc
        .perform(get(url).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rows[0].openingStock").value(0))
        .andExpect(jsonPath("$.rows[0].addedStock").value(2))
        .andExpect(jsonPath("$.rows[0].systemCountBeforeToday").value(2));
  }

  @Test
  void saveCountsPersistsAndReturnsUpdatedSheet() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID priceListId = createPriceList(orgId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);
    addItemToPriceList(orgId, priceListId, itemId);

    String date = LocalDate.now().toString();
    String saveBody =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":12}]}
        """
            .formatted(date, branchId, itemId);

    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(saveBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rows[0].closingStock").value(12))
        .andExpect(jsonPath("$.rows[0].lastSavedAt").exists());

    mockMvc
        .perform(
            get("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/std-stock-count?date="
                    + date)
                .with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rows[0].closingStock").value(12));
  }

  @Test
  void getSheetUsesPreviousBusinessDayClosingAsOpening() throws Exception {
    ZoneId zone = ZoneId.of("Africa/Nairobi");
    LocalDate today = LocalDate.now(zone);
    LocalDate yesterday = today.minusDays(1);

    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID priceListId = createPriceList(orgId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);
    addItemToPriceList(orgId, priceListId, itemId);

    String saveYesterday =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":5}]}
        """
            .formatted(yesterday, branchId, itemId);
    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(saveYesterday))
        .andExpect(status().isOk());

    String urlToday =
        "/api/v1/operator/orgs/"
            + orgId
            + "/branches/"
            + branchId
            + "/std-stock-count?date="
            + today;
    mockMvc
        .perform(get(urlToday).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rows[0].openingStock").value(5));
  }

  @Test
  void saveCountsPersistsCommentsWhenProvided() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID priceListId = createPriceList(orgId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);
    addItemToPriceList(orgId, priceListId, itemId);

    String date = LocalDate.now().toString();
    String saveBody =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":4,"comments":"Shelf check"}]}
        """
            .formatted(date, branchId, itemId);

    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(saveBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rows[0].comments").value("Shelf check"));

    mockMvc
        .perform(
            get("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/std-stock-count?date="
                    + date)
                .with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rows[0].comments").value("Shelf check"));
  }

  @Test
  void getSheetNotFoundWhenStaffNotInOrg() throws Exception {
    UUID orgId = createOrg();
    UUID otherOrgId = createOrg();
    UUID businessId = createBusiness(otherOrgId);
    UUID otherBranchId = createBranch(otherOrgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, createBranch(orgId, createBusiness(orgId)));

    String date = LocalDate.now().toString();
    String url =
        "/api/v1/operator/orgs/"
            + otherOrgId
            + "/branches/"
            + otherBranchId
            + "/std-stock-count?date="
            + date;

    mockMvc.perform(get(url).with(operatorJwt())).andExpect(status().isNotFound());
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Test Org StdStockCount " + UUID.randomUUID()));
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
    return createBranch(orgId, businessId, "Branch");
  }

  private UUID createBranch(UUID orgId, UUID businessId, String name) throws Exception {
    String body =
        """
        {"businessId":"%s","name":"%s","timezone":"Africa/Nairobi","currency":"KES"}
        """
            .formatted(businessId, name);
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
                    .content("{\"iamUserId\":\"operator\",\"username\":\"operator\"}"))
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

  private UUID createPriceList(UUID orgId) throws Exception {
    String body = """
        {"name":"Default","priority":0,"active":true}
        """;
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-lists")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
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

  private void createGrnForItem(UUID orgId, UUID branchId, UUID supplierId, UUID itemId)
      throws Exception {
    String body =
        """
        {"branchId":"%s","supplierId":"%s","lines":[{"itemId":"%s","qty":5,"receivedUnitCost":80.00}]}
        """
            .formatted(branchId, supplierId, itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }

  private void addItemToPriceList(UUID orgId, UUID priceListId, UUID itemId) throws Exception {
    String body =
        """
        {"itemId":"%s","price":99.50,"currency":"KES"}
        """.formatted(itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }
}
