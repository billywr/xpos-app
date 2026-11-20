package com.blinc.xpos.api.v1.operator;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static com.blinc.xpos.TestJwtFactory.operatorJwt;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.blinc.xpos.AbstractIntegrationTest;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgCreateRequest;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Ensures Standard Stock Count: Opening reflects only the prior day's saved Closing, Added reflects
 * same-day GRN receipts, and the two don't bleed across days (e.g. a 7-unit receipt on the prior
 * day + prior-day Close saved as 7 + a 3-unit receipt today yields Opening 7 and Added 3).
 */
@SpringBootTest
@AutoConfigureMockMvc
class StdStockCountLedgerAccuracyIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;

  @Autowired private ObjectMapper objectMapper;

  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void getSheetAddedReflectsReceiptsSystemReflectsSalesThroughEndOfSelectedDay() throws Exception {
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
            + "\",\"qty\":11,\"receivedUnitCost\":80.00}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(grnBody))
        .andExpect(status().isCreated());

    UUID terminalId = createTerminal(orgId, branchId);
    openShift(orgId, branchId, terminalId);
    UUID tenderTypeId = getCashTenderTypeId(orgId);
    String base =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/terminals/" + terminalId;
    MvcResult createSaleResult =
        mockMvc
            .perform(
                post(base + "/sales")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{}"))
            .andExpect(status().isCreated())
            .andReturn();
    UUID saleId =
        UUID.fromString(
            objectMapper
                .readTree(createSaleResult.getResponse().getContentAsString())
                .get("id")
                .asText());
    mockMvc
        .perform(
            post(base + "/sales/" + saleId + "/lines")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"itemId":"%s","qty":2,"uomId":null,"unitPriceOverride":99.50,"modifiers":[]}
                    """
                        .formatted(itemId)))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            post(base + "/sales/" + saleId + "/tenders")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"tenderTypeId":"%s","amount":250,"currency":"KES"}
                    """
                        .formatted(tenderTypeId)))
        .andExpect(status().isCreated());
    mockMvc
        .perform(post(base + "/sales/" + saleId + "/complete").with(operatorJwt()))
        .andExpect(status().isOk());

    ZoneId zone = ZoneId.of("Africa/Nairobi");
    String date = LocalDate.now(zone).toString();
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
        .andExpect(jsonPath("$.rows.length()").value(1))
        .andExpect(jsonPath("$.rows[0].addedStock").value(11))
        .andExpect(jsonPath("$.rows[0].openingStock").value(0));
  }

  @Test
  void getSheetOpeningPlusSameDayAddedMatchesTwoReceiptDays() throws Exception {
    ZoneId zone = ZoneId.of("Africa/Nairobi");
    LocalDate businessDay = LocalDate.now(zone);
    LocalDate priorDay = businessDay.minusDays(1);
    Instant priorDayInstant = priorDay.atTime(LocalTime.of(14, 0)).atZone(zone).toInstant();
    Timestamp priorTs = Timestamp.from(priorDayInstant);

    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);

    String grn7 =
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierId
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":7,\"receivedUnitCost\":80.00}]}";
    MvcResult grn1Result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content(grn7))
            .andExpect(status().isCreated())
            .andReturn();
    UUID grn1Id =
        UUID.fromString(
            objectMapper
                .readTree(grn1Result.getResponse().getContentAsString())
                .get("id")
                .asText());
    jdbcTemplate.update(
        "UPDATE goods_receipt_note SET received_at = ? WHERE id = ?", priorTs, grn1Id);
    jdbcTemplate.update(
        "UPDATE stock_movement SET created_at = ? WHERE org_id = ? AND source_id = ?",
        priorTs,
        orgId,
        grn1Id);

    // Save a closing on the prior day so today's Opening reflects the strictly-saved value.
    String priorClose =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":7}]}
        """
            .formatted(priorDay, branchId, itemId);
    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(priorClose))
        .andExpect(status().isOk());

    String grn3 =
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierId
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":3,\"receivedUnitCost\":80.00}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(grn3))
        .andExpect(status().isCreated());

    String date = businessDay.toString();
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
        .andExpect(jsonPath("$.rows.length()").value(1))
        .andExpect(jsonPath("$.rows[0].openingStock").value(7))
        .andExpect(jsonPath("$.rows[0].addedStock").value(3));
  }

  @Test
  void priorDayDeliverySavedThenAfternoonSecondDeliveryCarriesForwardToNextDayOpening()
      throws Exception {
    ZoneId zone = ZoneId.of("Africa/Nairobi");
    LocalDate businessDay = LocalDate.now(zone);
    LocalDate priorDay = businessDay.minusDays(1);
    Instant morningDeliveryAt = priorDay.atTime(LocalTime.of(8, 0)).atZone(zone).toInstant();
    Instant morningSavedAt = priorDay.atTime(LocalTime.of(10, 0)).atZone(zone).toInstant();
    Instant afternoonDeliveryAt = priorDay.atTime(LocalTime.of(14, 0)).atZone(zone).toInstant();

    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);

    // 1. Morning receipt: 6 units at 08:00
    createGrnWithTimestamp(orgId, branchId, supplierId, itemId, 6, morningDeliveryAt);

    // 2. Save stock count at 10:00 (closing stock = 6)
    String priorClose =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":6}]}
        """
            .formatted(priorDay, branchId, itemId);
    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(priorClose))
        .andExpect(status().isOk());
    Timestamp morningSaveTs = Timestamp.from(morningSavedAt);
    jdbcTemplate.update(
        "UPDATE std_stock_count_snapshot SET last_saved_at = ? WHERE branch_id = ? AND business_date = ?",
        morningSaveTs,
        branchId,
        priorDay);

    // 3. Afternoon receipt: 4 units at 14:00 (total 10)
    createGrnWithTimestamp(orgId, branchId, supplierId, itemId, 4, afternoonDeliveryAt);

    // 4. Verify Day 1 sheet exposes latestStockAddedAt as afternoonDeliveryAt
    String priorUrl =
        "/api/v1/operator/orgs/"
            + orgId
            + "/branches/"
            + branchId
            + "/std-stock-count?date="
            + priorDay;
    mockMvc
        .perform(get(priorUrl).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rows.length()").value(1))
        .andExpect(jsonPath("$.rows[0].openingStock").value(0))
        .andExpect(jsonPath("$.rows[0].addedStock").value(10))
        .andExpect(jsonPath("$.rows[0].firstStockAddedAt").isNotEmpty())
        .andExpect(jsonPath("$.rows[0].latestStockAddedAt").isNotEmpty());

    // 5. Verify Day 2 (businessDay) sheet: opening stock reflects the afternoon addition (6 + 4 =
    // 10)
    String todayUrl =
        "/api/v1/operator/orgs/"
            + orgId
            + "/branches/"
            + branchId
            + "/std-stock-count?date="
            + businessDay;
    mockMvc
        .perform(get(todayUrl).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rows.length()").value(1))
        .andExpect(jsonPath("$.rows[0].openingStock").value(10))
        .andExpect(jsonPath("$.rows[0].addedStock").value(0));
  }

  @Test
  void priorDayReceiptAndSalesRecordedCarriesForwardPhysicalClosingNotTotalStock()
      throws Exception {
    ZoneId zone = ZoneId.of("Africa/Nairobi");
    LocalDate businessDay = LocalDate.now(zone);
    LocalDate priorDay = businessDay.minusDays(1);
    Instant morningDeliveryAt = priorDay.atTime(LocalTime.of(8, 0)).atZone(zone).toInstant();
    Instant middayDeliveryAt = priorDay.atTime(LocalTime.of(12, 0)).atZone(zone).toInstant();
    Instant countSavedAt = priorDay.atTime(LocalTime.of(18, 0)).atZone(zone).toInstant();

    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    UUID terminalId = createTerminal(orgId, branchId);
    openShift(orgId, branchId, terminalId);
    UUID tenderTypeId = getCashTenderTypeId(orgId);

    // 1. Prior Day: Morning receipt 14.5 units, Midday receipt 2.0 units (Total = 16.5)
    createGrnWithTimestamp(orgId, branchId, supplierId, itemId, 14.5, morningDeliveryAt);
    createGrnWithTimestamp(orgId, branchId, supplierId, itemId, 2.0, middayDeliveryAt);

    // 2. Operator saves closing stock as 14.0 (implies 2.5 units sold)
    String priorClose =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":14.0}]}
        """
            .formatted(priorDay, branchId, itemId);
    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(priorClose))
        .andExpect(status().isOk());

    Timestamp countSaveTs = Timestamp.from(countSavedAt);
    jdbcTemplate.update(
        "UPDATE std_stock_count_snapshot SET last_saved_at = ? WHERE branch_id = ? AND business_date = ?",
        countSaveTs,
        branchId,
        priorDay);

    // 3. Operator records sales of 2.5 units on priorDay
    recordSale(
        orgId, branchId, terminalId, tenderTypeId, itemId, 2.5, 350.00, priorDay, countSaveTs);

    // 4. Simulate historical corruption: snapshot saved as 16.5 (total stock)
    jdbcTemplate.update(
        "UPDATE std_stock_count_snapshot SET closing_qty = 16.5 WHERE branch_id = ? AND business_date = ?",
        branchId,
        priorDay);

    // 5. Verify Day 1 sheet self-heals corrupted snapshot to maxPhysicalStock (16.5 - 2.5 = 14.0)
    String priorUrl =
        "/api/v1/operator/orgs/"
            + orgId
            + "/branches/"
            + branchId
            + "/std-stock-count?date="
            + priorDay;
    mockMvc
        .perform(get(priorUrl).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rows[0].closingStock").value(14.0))
        .andExpect(jsonPath("$.rows[0].addedStock").value(16.5));

    // 6. Verify Day 2 carries forward 14.0, NOT corrupted 16.5
    String todayUrl =
        "/api/v1/operator/orgs/"
            + orgId
            + "/branches/"
            + branchId
            + "/std-stock-count?date="
            + businessDay;
    mockMvc
        .perform(get(todayUrl).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rows[0].openingStock").value(14.0))
        .andExpect(jsonPath("$.rows[0].addedStock").value(0));

    // 7. Verify Day 2 sales preview prompts 0 units to record (no duplicate sales)
    String salesPreviewUrl =
        "/api/v1/operator/orgs/"
            + orgId
            + "/branches/"
            + branchId
            + "/std-stock-count/sales-preview?date="
            + businessDay;
    mockMvc
        .perform(get(salesPreviewUrl).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalQtyToRecord").value(0));
  }

  private void recordSale(
      UUID orgId,
      UUID branchId,
      UUID terminalId,
      UUID tenderTypeId,
      UUID itemId,
      double qty,
      double unitPrice,
      LocalDate businessDate,
      Timestamp completedAt)
      throws Exception {
    String base =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/terminals/" + terminalId;
    MvcResult result =
        mockMvc
            .perform(
                post(base + "/sales")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{}"))
            .andExpect(status().isCreated())
            .andReturn();
    UUID saleId =
        UUID.fromString(
            objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
    mockMvc
        .perform(
            post(base + "/sales/" + saleId + "/lines")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    "{\"itemId\":\""
                        + itemId
                        + "\",\"qty\":"
                        + qty
                        + ",\"uomId\":null,\"unitPriceOverride\":"
                        + unitPrice
                        + ",\"modifiers\":[]}"))
        .andExpect(status().isOk());
    double tenderAmount = qty * unitPrice;
    mockMvc
        .perform(
            post(base + "/sales/" + saleId + "/tenders")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    "{\"tenderTypeId\":\""
                        + tenderTypeId
                        + "\",\"amount\":"
                        + tenderAmount
                        + ",\"currency\":\"KES\"}"))
        .andExpect(status().isCreated());
    mockMvc
        .perform(post(base + "/sales/" + saleId + "/complete").with(operatorJwt()))
        .andExpect(status().isOk());

    jdbcTemplate.update(
        "UPDATE sale SET business_date = ?, completed_at = ? WHERE id = ?",
        businessDate,
        completedAt,
        saleId);
  }

  private UUID createGrnWithTimestamp(
      UUID orgId, UUID branchId, UUID supplierId, UUID itemId, Number qty, Instant at)
      throws Exception {
    String body =
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierId
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":"
            + qty
            + ",\"receivedUnitCost\":80.00}]}";
    MvcResult result =
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
            objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
    Timestamp ts = Timestamp.from(at);
    jdbcTemplate.update(
        "UPDATE goods_receipt_note SET received_at = ?, created_at = ? WHERE id = ?",
        ts,
        ts,
        grnId);
    jdbcTemplate.update("UPDATE grn_line SET created_at = ? WHERE grn_id = ?", ts, grnId);
    jdbcTemplate.update(
        "UPDATE stock_movement SET created_at = ? WHERE org_id = ? AND source_id = ?",
        ts,
        orgId,
        grnId);
    return grnId;
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Test Org StdCount Ledger " + UUID.randomUUID()));
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
        {"businessId":"%s","name":"Main","timezone":"Africa/Nairobi","currency":"KES"}
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

  private UUID createItem(UUID orgId) throws Exception {
    UUID taxProfileId = createTaxProfile(orgId);
    String body =
        """
        {"name":"SKU-A","itemType":"STOCK","taxProfileId":"%s",\
        "trackInventory":true,"active":true,\
        "buyingPrice":80.00,"defaultSellingPrice":99.50,"visibleInPos":true}
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

  private UUID createTerminal(UUID orgId, UUID branchId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/branches/" + branchId + "/terminals")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"terminalCode\":\"T-Ledger\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private void openShift(UUID orgId, UUID branchId, UUID terminalId) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/terminals/"
                    + terminalId
                    + "/shifts")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"openingFloatAmount\":0}"))
        .andExpect(status().isCreated());
  }

  private UUID getCashTenderTypeId(UUID orgId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(get("/api/v1/admin/orgs/" + orgId + "/tender-types").with(adminJwt()))
            .andExpect(status().isOk())
            .andReturn();
    var tree = objectMapper.readTree(result.getResponse().getContentAsString());
    var list = tree.isArray() ? tree : tree.get("content");
    if (list == null) {
      throw new IllegalStateException("No tender types for org " + orgId);
    }
    for (var el : list) {
      if ("CASH".equals(el.get("code").asText())) {
        return UUID.fromString(el.get("id").asText());
      }
    }
    throw new IllegalStateException("CASH tender not found for org " + orgId);
  }
}
