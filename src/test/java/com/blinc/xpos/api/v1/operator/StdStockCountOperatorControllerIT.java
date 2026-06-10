package com.blinc.xpos.api.v1.operator;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static com.blinc.xpos.TestJwtFactory.operatorJwt;
import static org.junit.jupiter.api.Assertions.assertEquals;
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
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/** Integration test for Standard Stock Count Sheet operator API. */
@SpringBootTest
@AutoConfigureMockMvc
class StdStockCountOperatorControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;

  @Autowired private ObjectMapper objectMapper;

  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void getSheetReturnsRowsFromPriceListItems() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);

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
        .andExpect(jsonPath("$.rows[0].addedTodayStock").value(0));
  }

  @Test
  void getSheetSplitsGrnAddedAndStockTakeAddedToday() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);

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
        .andExpect(jsonPath("$.rows[0].addedTodayStock").value(3));
  }

  @Test
  void getSheetAddedStockIsNetGrnInMinusOutAfterReceiptLineReduction() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

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
        .andExpect(jsonPath("$.rows[0].addedStock").value(2));
  }

  @Test
  void saveCountsSecondPutUpdatesClosingWhenSnapshotAlreadyExists() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);

    String date = LocalDate.now().toString();
    String firstSave =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":5}]}
        """
            .formatted(date, branchId, itemId);
    String secondSave =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":7}]}
        """
            .formatted(date, branchId, itemId);
    String url = "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count";

    mockMvc
        .perform(put(url).with(operatorJwt()).contentType(APPLICATION_JSON).content(firstSave))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rows[0].closingStock").value(5));

    mockMvc
        .perform(put(url).with(operatorJwt()).contentType(APPLICATION_JSON).content(secondSave))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rows[0].closingStock").value(7));

    Integer rowCount =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*) FROM std_stock_count_snapshot
            WHERE branch_id = ? AND item_id = ? AND business_date = ?
            """,
            Integer.class,
            branchId,
            itemId,
            LocalDate.parse(date));
    assertEquals(1, rowCount);
  }

  @Test
  void saveCountsPersistsAndReturnsUpdatedSheet() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);

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

    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);

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
  void getSheetUsesLatestPriorSnapshotWhenDaysSkipped() throws Exception {
    ZoneId zone = ZoneId.of("Africa/Nairobi");
    LocalDate today = LocalDate.now(zone);
    LocalDate threeDaysAgo = today.minusDays(3);

    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);

    String saveThreeDaysAgo =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":10}]}
        """
            .formatted(threeDaysAgo, branchId, itemId);
    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(saveThreeDaysAgo))
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
        .andExpect(jsonPath("$.rows[0].openingStock").value(10));
  }

  @Test
  void getSheetAddedReflectsSameDayGrnOnlyWhenDaysSkipped() throws Exception {
    ZoneId zone = ZoneId.of("Africa/Nairobi");
    LocalDate today = LocalDate.now(zone);
    LocalDate threeDaysAgo = today.minusDays(3);
    LocalDate twoDaysAgo = today.minusDays(2);

    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);

    String saveThreeDaysAgo =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":10}]}
        """
            .formatted(threeDaysAgo, branchId, itemId);
    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(saveThreeDaysAgo))
        .andExpect(status().isOk());

    createGrnForItemOnDate(orgId, branchId, supplierId, itemId, 5, twoDaysAgo, zone);
    createGrnForItemOnDate(orgId, branchId, supplierId, itemId, 3, today, zone);

    String urlTwoDaysAgo =
        "/api/v1/operator/orgs/"
            + orgId
            + "/branches/"
            + branchId
            + "/std-stock-count?date="
            + twoDaysAgo;
    mockMvc
        .perform(get(urlTwoDaysAgo).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rows[0].openingStock").value(10))
        .andExpect(jsonPath("$.rows[0].addedStock").value(5));

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
        .andExpect(jsonPath("$.rows[0].openingStock").value(10))
        .andExpect(jsonPath("$.rows[0].addedStock").value(3));
  }

  @Test
  void getSheetSkipsBlankBulkZeroSaveWhenCarryingOpeningForward() throws Exception {
    ZoneId zone = ZoneId.of("Africa/Nairobi");
    LocalDate today = LocalDate.now(zone);
    LocalDate threeDaysAgo = today.minusDays(3);
    LocalDate yesterday = today.minusDays(1);

    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId, "Balozi bottle");
    UUID itemId2 = createItem(orgId, "Best gin 250ml");

    String saveThreeDaysAgo =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":10}]}
        """
            .formatted(threeDaysAgo, branchId, itemId);
    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(saveThreeDaysAgo))
        .andExpect(status().isOk());

    String blankBulkSave =
        """
        {"date":"%s","outletId":"%s","counts":[\
        {"itemId":"%s","closingStock":0},\
        {"itemId":"%s","closingStock":0}]}
        """
            .formatted(yesterday, branchId, itemId, itemId2);
    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(blankBulkSave))
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
        .andExpect(jsonPath("$.rows[0].openingStock").value(10));
  }

  @Test
  void saveCountsPersistsCommentsWhenProvided() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);

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
  void getSheetOpeningReflectsGrnReceivedAfterLastSave() throws Exception {
    ZoneId zone = ZoneId.of("Africa/Nairobi");
    LocalDate today = LocalDate.now(zone);
    LocalDate priorDay = today.minusDays(1);
    Instant priorMorning = priorDay.atTime(8, 0).atZone(zone).toInstant();

    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);

    String savePrior =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":0}]}
        """
            .formatted(priorDay, branchId, itemId);
    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(savePrior))
        .andExpect(status().isOk());

    createGrnForItemOnDate(orgId, branchId, supplierId, itemId, 1, priorDay, zone);
    backdateSnapshotLastSavedAt(branchId, itemId, priorDay, priorMorning);

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
        .andExpect(jsonPath("$.rows[0].openingStock").value(1))
        .andExpect(jsonPath("$.rows[0].addedStock").value(0));
  }

  @Test
  void getSheetOpeningDoesNotDoubleCountGrnWhenSavedClosingEqualsDayTotal() throws Exception {
    ZoneId zone = ZoneId.of("Africa/Nairobi");
    LocalDate today = LocalDate.now(zone);
    LocalDate priorDay = today.minusDays(1);
    Instant priorMorning = priorDay.atTime(8, 0).atZone(zone).toInstant();

    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId, "Bond 7 - 750ml");

    createGrnForItemOnDate(orgId, branchId, supplierId, itemId, 1, priorDay, zone);

    String savePrior =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":1}]}
        """
            .formatted(priorDay, branchId, itemId);
    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(savePrior))
        .andExpect(status().isOk());

    backdateSnapshotLastSavedAt(branchId, itemId, priorDay, priorMorning);

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
        .andExpect(jsonPath("$.rows[0].openingStock").value(1))
        .andExpect(jsonPath("$.rows[0].addedStock").value(0));
  }

  @Test
  void getSheetOpeningUnchangedWhenClosingSavedAfterGrn() throws Exception {
    ZoneId zone = ZoneId.of("Africa/Nairobi");
    LocalDate today = LocalDate.now(zone);
    LocalDate priorDay = today.minusDays(1);

    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);

    createGrnForItemOnDate(orgId, branchId, supplierId, itemId, 7, priorDay, zone);

    String savePrior =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":7}]}
        """
            .formatted(priorDay, branchId, itemId);
    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(savePrior))
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
        .andExpect(jsonPath("$.rows[0].openingStock").value(7))
        .andExpect(jsonPath("$.rows[0].addedStock").value(0));
  }

  @Test
  void getSheetOpeningAddsLateStockTakeAfterSave() throws Exception {
    ZoneId zone = ZoneId.of("Africa/Nairobi");
    LocalDate today = LocalDate.now(zone);
    LocalDate priorDay = today.minusDays(1);
    Instant priorMorning = priorDay.atTime(8, 0).atZone(zone).toInstant();
    Instant priorEvening = priorDay.atTime(18, 0).atZone(zone).toInstant();

    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    UUID itemId = createItem(orgId);

    String savePrior =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":5}]}
        """
            .formatted(priorDay, branchId, itemId);
    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(savePrior))
        .andExpect(status().isOk());

    backdateSnapshotLastSavedAt(branchId, itemId, priorDay, priorMorning);

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

    jdbcTemplate.update(
        """
        UPDATE stock_movement SET created_at = ?
        WHERE org_id = ? AND branch_id = ? AND item_id = ?
          AND movement_type = 'ADJUST' AND source_type = 'STOCKTAKE'
        """,
        Timestamp.from(priorEvening),
        orgId,
        branchId,
        itemId);

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
        .andExpect(jsonPath("$.rows[0].openingStock").value(13));
  }

  @Test
  void getSheetOpeningUsesDayTotalWhenSavedClosingEqualsOpeningAndGrnSameDay() throws Exception {
    ZoneId zone = ZoneId.of("Africa/Nairobi");
    LocalDate today = LocalDate.now(zone);
    LocalDate priorDay = today.minusDays(1);
    LocalDate twoDaysAgo = today.minusDays(2);

    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId, "Viceroy 250ml");

    String seedOpening =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":1}]}
        """
            .formatted(twoDaysAgo, branchId, itemId);
    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(seedOpening))
        .andExpect(status().isOk());

    createGrnForItemOnDate(orgId, branchId, supplierId, itemId, 2, priorDay, zone);

    String staleSave =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":1}]}
        """
            .formatted(priorDay, branchId, itemId);
    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(staleSave))
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
        .andExpect(jsonPath("$.rows[0].openingStock").value(3))
        .andExpect(jsonPath("$.rows[0].addedStock").value(0));
  }

  @Test
  void getSheetOpeningRespectsSalesWhenSavedClosingBelowOpening() throws Exception {
    ZoneId zone = ZoneId.of("Africa/Nairobi");
    LocalDate today = LocalDate.now(zone);
    LocalDate priorDay = today.minusDays(1);
    LocalDate twoDaysAgo = today.minusDays(2);

    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    UUID itemId = createItem(orgId, "Viceroy 750ml");

    String seedOpening =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":8}]}
        """
            .formatted(twoDaysAgo, branchId, itemId);
    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(seedOpening))
        .andExpect(status().isOk());

    String soldSave =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":5}]}
        """
            .formatted(priorDay, branchId, itemId);
    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(soldSave))
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
        .andExpect(jsonPath("$.rows[0].openingStock").value(5))
        .andExpect(jsonPath("$.rows[0].addedStock").value(0));
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
    String body =
        """
        {"name":"VAT Standard %s","vatCategory":"STANDARD","serviceChargeRate":0,"levyRate":0}
        """
            .formatted(UUID.randomUUID());
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

  @Test
  void reconcilePreviewShowsVarianceAndPostUpdatesOnHand() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);

    String date = LocalDate.now().toString();
    String saveBody =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":5}]}
        """
            .formatted(date, branchId, itemId);
    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(saveBody))
        .andExpect(status().isOk());

    setOnHandQty(orgId, branchId, itemId, new BigDecimal("3.000"));

    String previewUrl =
        "/api/v1/operator/orgs/"
            + orgId
            + "/branches/"
            + branchId
            + "/std-stock-count/reconcile-preview?date="
            + date;
    mockMvc
        .perform(get(previewUrl).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.itemsAdjusted").value(1))
        .andExpect(jsonPath("$.lines.length()").value(1))
        .andExpect(jsonPath("$.lines[0].closingStock").value(5))
        .andExpect(jsonPath("$.lines[0].onHandQty").value(3))
        .andExpect(jsonPath("$.lines[0].variance").value(2));

    String reconcileBody =
        """
        {"date":"%s","outletId":"%s"}
        """.formatted(date, branchId);
    mockMvc
        .perform(
            post("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/std-stock-count/reconcile-inventory")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(reconcileBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.adjustedCount").value(1));

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/inventory-report?branchId=" + branchId)
                .with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].onHandQty").value(5));

    Integer adjustCount =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*) FROM stock_movement
            WHERE org_id = ? AND branch_id = ? AND item_id = ?
              AND movement_type = 'ADJUST' AND source_type = 'STD_STOCK_COUNT_RECONCILE'
            """,
            Integer.class,
            orgId,
            branchId,
            itemId);
    assertEquals(1, adjustCount);
  }

  @Test
  void reconcileOnceClearsPreviewWithoutInflatingAddedToday() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);

    String date = LocalDate.now().toString();
    String saveBody =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":5}]}
        """
            .formatted(date, branchId, itemId);
    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(saveBody))
        .andExpect(status().isOk());

    setOnHandQty(orgId, branchId, itemId, new BigDecimal("3.000"));

    String sheetUrl =
        "/api/v1/operator/orgs/"
            + orgId
            + "/branches/"
            + branchId
            + "/std-stock-count?date="
            + date;
    mockMvc
        .perform(get(sheetUrl).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rows[0].addedTodayStock").value(0));

    String reconcileBody =
        """
        {"date":"%s","outletId":"%s"}
        """.formatted(date, branchId);
    mockMvc
        .perform(
            post("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/std-stock-count/reconcile-inventory")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(reconcileBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.adjustedCount").value(1));

    mockMvc
        .perform(get(sheetUrl).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rows[0].addedTodayStock").value(0))
        .andExpect(jsonPath("$.rows[0].closingStock").value(5));

    String previewUrl =
        "/api/v1/operator/orgs/"
            + orgId
            + "/branches/"
            + branchId
            + "/std-stock-count/reconcile-preview?date="
            + date;
    mockMvc
        .perform(get(previewUrl).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.itemsAdjusted").value(0))
        .andExpect(jsonPath("$.lines.length()").value(0));

    assertReconcileMovementUsesDedicatedSourceType(orgId, branchId, itemId);
  }

  @Test
  void reconcilePreviewReturnsZeroWhenAlreadyMatched() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);

    String date = LocalDate.now().toString();
    String saveBody =
        """
        {"date":"%s","outletId":"%s","counts":[{"itemId":"%s","closingStock":5}]}
        """
            .formatted(date, branchId, itemId);
    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/std-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(saveBody))
        .andExpect(status().isOk());

    String previewUrl =
        "/api/v1/operator/orgs/"
            + orgId
            + "/branches/"
            + branchId
            + "/std-stock-count/reconcile-preview?date="
            + date;
    mockMvc
        .perform(get(previewUrl).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.itemsAdjusted").value(0))
        .andExpect(jsonPath("$.itemsAlreadyMatched").value(1))
        .andExpect(jsonPath("$.lines.length()").value(0));

    String reconcileBody =
        """
        {"date":"%s","outletId":"%s"}
        """.formatted(date, branchId);
    mockMvc
        .perform(
            post("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/std-stock-count/reconcile-inventory")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(reconcileBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.adjustedCount").value(0));
  }

  @Test
  void reconcileRejectsNonTodayDate() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    LocalDate yesterday = LocalDate.now().minusDays(1);
    String previewUrl =
        "/api/v1/operator/orgs/"
            + orgId
            + "/branches/"
            + branchId
            + "/std-stock-count/reconcile-preview?date="
            + yesterday;
    mockMvc
        .perform(get(previewUrl).with(operatorJwt()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("RECONCILE_DATE_NOT_TODAY"));
  }

  @Test
  void reconcilePreviewExcludesUnsavedClosing() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);

    setOnHandQty(orgId, branchId, itemId, new BigDecimal("3.000"));

    String date = LocalDate.now().toString();
    String previewUrl =
        "/api/v1/operator/orgs/"
            + orgId
            + "/branches/"
            + branchId
            + "/std-stock-count/reconcile-preview?date="
            + date;
    mockMvc
        .perform(get(previewUrl).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.itemsAdjusted").value(0))
        .andExpect(jsonPath("$.lines.length()").value(0));
  }

  private void setOnHandQty(UUID orgId, UUID branchId, UUID itemId, BigDecimal qty) {
    jdbcTemplate.update(
        "UPDATE inventory_item SET on_hand_qty = ? WHERE org_id = ? AND branch_id = ? AND item_id = ?",
        qty,
        orgId,
        branchId,
        itemId);
  }

  private void assertReconcileMovementUsesDedicatedSourceType(
      UUID orgId, UUID branchId, UUID itemId) {
    Integer reconcileMovementCount =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*) FROM stock_movement
            WHERE org_id = ? AND branch_id = ? AND item_id = ?
              AND movement_type = 'ADJUST' AND source_type = 'STD_STOCK_COUNT_RECONCILE'
            """,
            Integer.class,
            orgId,
            branchId,
            itemId);
    assertEquals(1, reconcileMovementCount);

    Integer stocktakeAddedTodayCount =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*) FROM stock_movement
            WHERE org_id = ? AND branch_id = ? AND item_id = ?
              AND movement_type = 'ADJUST' AND source_type = 'STOCKTAKE' AND qty > 0
            """,
            Integer.class,
            orgId,
            branchId,
            itemId);
    assertEquals(0, stocktakeAddedTodayCount);
  }

  private void backdateSnapshotLastSavedAt(
      UUID branchId, UUID itemId, LocalDate businessDate, Instant lastSavedAt) {
    jdbcTemplate.update(
        """
        UPDATE std_stock_count_snapshot SET last_saved_at = ?
        WHERE branch_id = ? AND item_id = ? AND business_date = ?
        """,
        Timestamp.from(lastSavedAt),
        branchId,
        itemId,
        businessDate);
  }

  private void createGrnForItem(UUID orgId, UUID branchId, UUID supplierId, UUID itemId)
      throws Exception {
    createGrnForItemOnDate(
        orgId, branchId, supplierId, itemId, 5, LocalDate.now(), ZoneId.of("Africa/Nairobi"));
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
    String grnJson = grnResult.getResponse().getContentAsString();
    UUID grnId = UUID.fromString(objectMapper.readTree(grnJson).get("id").asText());
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
