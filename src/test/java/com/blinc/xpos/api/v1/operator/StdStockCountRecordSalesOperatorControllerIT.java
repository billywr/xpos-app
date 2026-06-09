package com.blinc.xpos.api.v1.operator;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static com.blinc.xpos.TestJwtFactory.noRoleJwt;
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

/** Integration tests for recording sales from the Standard Stock Count Sheet. */
@SpringBootTest
@AutoConfigureMockMvc
class StdStockCountRecordSalesOperatorControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void happyPathPreviewAndRecordSalesFromSavedClosing() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID terminalId = createTerminal(orgId, branchId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);

    String date = LocalDate.now().toString();
    saveClosing(orgId, branchId, date, itemId, 2);

    String stdBase = stdStockCountBase(orgId, branchId);
    mockMvc
        .perform(get(stdBase + "/sales-preview?date=" + date).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalQtyToRecord").value(3))
        .andExpect(jsonPath("$.lines[0].impliedSold").value(3))
        .andExpect(jsonPath("$.lines[0].qtyToRecord").value(3));

    String recordBody =
        """
        {"date":"%s","terminalId":"%s"}
        """.formatted(date, terminalId);
    mockMvc
        .perform(
            post(stdBase + "/record-sales")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(recordBody))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.saleIds.length()").value(1))
        .andExpect(jsonPath("$.totalItemsRecorded").value(3))
        .andExpect(jsonPath("$.lines[0].status").value("RECORDED"));
  }

  @Test
  void previewAndRecordIncludeAllItemsOnFullSheet() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID terminalId = createTerminal(orgId, branchId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId);
    UUID itemA = createItem(orgId, "Product A");
    UUID itemB = createItem(orgId, "Product B");
    createGrnForItems(orgId, branchId, supplierId, itemA, itemB);
    String date = LocalDate.now().toString();
    String saveBody =
        """
        {"date":"%s","outletId":"%s","counts":[\
        {"itemId":"%s","closingStock":0},\
        {"itemId":"%s","closingStock":0}\
        ]}
        """
            .formatted(date, branchId, itemA, itemB);
    mockMvc
        .perform(
            put(stdStockCountBase(orgId, branchId))
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(saveBody))
        .andExpect(status().isOk());

    String stdBase = stdStockCountBase(orgId, branchId);
    mockMvc
        .perform(get(stdBase + "/sales-preview?date=" + date).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lines.length()").value(2))
        .andExpect(jsonPath("$.totalQtyToRecord").value(10));

    mockMvc
        .perform(
            post(stdBase + "/record-sales")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"date":"%s","terminalId":"%s"}
                    """
                        .formatted(date, terminalId)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.saleIds.length()").value(2))
        .andExpect(jsonPath("$.totalItemsRecorded").value(10));
  }

  @Test
  void posOverlapRecordsOnlyDelta() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID terminalId = createTerminal(orgId, branchId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);

    String date = LocalDate.now().toString();
    saveClosing(orgId, branchId, date, itemId, 0);

    String salesRecordingBase =
        "/api/v1/operator/orgs/"
            + orgId
            + "/branches/"
            + branchId
            + "/terminals/"
            + terminalId
            + "/sales-recording";
    mockMvc
        .perform(
            post(salesRecordingBase)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"saleDate":"%s","entries":[{"itemId":"%s","qty":2}]}
                    """
                        .formatted(date, itemId)))
        .andExpect(status().isCreated());

    String stdBase = stdStockCountBase(orgId, branchId);
    mockMvc
        .perform(get(stdBase + "/sales-preview?date=" + date).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lines[0].impliedSold").value(5))
        .andExpect(jsonPath("$.lines[0].alreadyRecorded").value(2))
        .andExpect(jsonPath("$.lines[0].qtyToRecord").value(3))
        .andExpect(jsonPath("$.totalQtyToRecord").value(3));

    mockMvc
        .perform(
            post(stdBase + "/record-sales")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"date":"%s","terminalId":"%s"}
                    """
                        .formatted(date, terminalId)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.saleIds.length()").value(1))
        .andExpect(jsonPath("$.totalItemsRecorded").value(3));
  }

  @Test
  void idempotentReRunRecordsNothing() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID terminalId = createTerminal(orgId, branchId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);

    String date = LocalDate.now().toString();
    saveClosing(orgId, branchId, date, itemId, 2);

    String recordBody =
        """
        {"date":"%s","terminalId":"%s"}
        """.formatted(date, terminalId);
    String stdBase = stdStockCountBase(orgId, branchId);
    mockMvc
        .perform(
            post(stdBase + "/record-sales")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(recordBody))
        .andExpect(status().isCreated());

    mockMvc
        .perform(
            post(stdBase + "/record-sales")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(recordBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.saleIds.length()").value(0))
        .andExpect(jsonPath("$.totalItemsRecorded").value(0));
  }

  @Test
  void previewSkipsRowsWithoutSavedClosing() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);

    String date = LocalDate.now().toString();
    mockMvc
        .perform(
            get(stdStockCountBase(orgId, branchId) + "/sales-preview?date=" + date)
                .with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lines[0].status").value("SKIPPED_NO_CLOSING"))
        .andExpect(jsonPath("$.totalQtyToRecord").value(0));
  }

  @Test
  void insufficientStockReturnsConflict() throws Exception {
    ZoneId zone = ZoneId.of("Africa/Nairobi");
    LocalDate today = LocalDate.now(zone);
    LocalDate yesterday = today.minusDays(1);

    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID terminalId = createTerminal(orgId, branchId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItemOnDate(orgId, branchId, supplierId, itemId, 5, yesterday, zone);

    saveClosing(orgId, branchId, yesterday.toString(), itemId, 20);
    saveClosing(orgId, branchId, today.toString(), itemId, 0);

    mockMvc
        .perform(
            post(stdStockCountBase(orgId, branchId) + "/record-sales")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"date":"%s","terminalId":"%s"}
                    """
                        .formatted(today, terminalId)))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("INSUFFICIENT_STOCK"));
  }

  @Test
  void rejectsFutureDateOnPreview() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    LocalDate future = LocalDate.now().plusDays(1);
    mockMvc
        .perform(
            get(stdStockCountBase(orgId, branchId) + "/sales-preview?date=" + future)
                .with(operatorJwt()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("SALE_DATE_FUTURE"));
  }

  @Test
  void noRoleIsForbidden() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    mockMvc
        .perform(
            get(stdStockCountBase(orgId, branchId) + "/sales-preview?date=" + LocalDate.now())
                .with(noRoleJwt()))
        .andExpect(status().isForbidden());
  }

  private static String stdStockCountBase(UUID orgId, UUID branchId) {
    return "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count";
  }

  private void saveClosing(UUID orgId, UUID branchId, String date, UUID itemId, int closingStock)
      throws Exception {
    String saveBody =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":%d}]}
        """
            .formatted(date, branchId, itemId, closingStock);
    mockMvc
        .perform(
            put(stdStockCountBase(orgId, branchId))
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(saveBody))
        .andExpect(status().isOk());
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Test Org StdStockCount Sales " + UUID.randomUUID()));
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
        """
        {"businessId":"%s","name":"Branch","timezone":"Africa/Nairobi","currency":"KES"}
        """
            .formatted(businessId);
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

  private UUID createTerminal(UUID orgId, UUID branchId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/branches/" + branchId + "/terminals")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"terminalCode\":\"T1\"}"))
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

  private UUID createItem(UUID orgId) throws Exception {
    return createItem(orgId, "Test Product");
  }

  private UUID createItem(UUID orgId, String name) throws Exception {
    UUID taxProfileId = createTaxProfile(orgId);
    String body =
        """
        {"name":"%s","itemType":"STOCK","taxProfileId":"%s",\
        "trackInventory":true,"active":true,\
        "buyingPrice":80.00,"defaultSellingPrice":99.50,"visibleInPos":true}
        """
            .formatted(name, taxProfileId);
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
                        """
                        {"name":"VAT Standard %s","vatCategory":"STANDARD",\
                        "serviceChargeRate":0,"levyRate":0}
                        """
                            .formatted(UUID.randomUUID())))
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
    createGrnForItemOnDate(
        orgId, branchId, supplierId, itemId, 5, LocalDate.now(), ZoneId.of("Africa/Nairobi"));
  }

  private void createGrnForItems(UUID orgId, UUID branchId, UUID supplierId, UUID itemA, UUID itemB)
      throws Exception {
    LocalDate receivedDate = LocalDate.now();
    ZoneId zone = ZoneId.of("Africa/Nairobi");
    String body =
        """
        {"branchId":"%s","supplierId":"%s","lines":[\
        {"itemId":"%s","qty":5,"receivedUnitCost":80.00},\
        {"itemId":"%s","qty":5,"receivedUnitCost":80.00}\
        ]}
        """
            .formatted(branchId, supplierId, itemA, itemB);
    MvcResult grnResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    UUID grnId =
        UUID.fromString(
            objectMapper.readTree(grnResult.getResponse().getContentAsString()).get("id").asText());
    String receivedAt = receivedDate.atTime(12, 0).atZone(zone).toInstant().toString();
    String patchBody =
        """
        {"supplierId":"%s","receivedAt":"%s","lines":[\
        {"itemId":"%s","qty":5,"receivedUnitCost":80.00},\
        {"itemId":"%s","qty":5,"receivedUnitCost":80.00}\
        ]}
        """
            .formatted(supplierId, receivedAt, itemA, itemB);
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes/" + grnId)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(patchBody))
        .andExpect(status().isOk());
  }

  private void createGrnForItemOnDate(
      UUID orgId,
      UUID branchId,
      UUID supplierId,
      UUID itemId,
      int qty,
      LocalDate receivedDate,
      ZoneId zone)
      throws Exception {
    String body =
        """
        {"branchId":"%s","supplierId":"%s","lines":[{"itemId":"%s","qty":%d,"receivedUnitCost":80.00}]}
        """
            .formatted(branchId, supplierId, itemId, qty);
    MvcResult grnResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    UUID grnId =
        UUID.fromString(
            objectMapper.readTree(grnResult.getResponse().getContentAsString()).get("id").asText());
    String receivedAt = receivedDate.atTime(12, 0).atZone(zone).toInstant().toString();
    String patchBody =
        "{\"supplierId\":\""
            + supplierId
            + "\",\"receivedAt\":\""
            + receivedAt
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":"
            + qty
            + ",\"receivedUnitCost\":80.00}]}";
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes/" + grnId)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(patchBody))
        .andExpect(status().isOk());
  }
}
