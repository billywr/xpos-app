package com.blinc.xpos.api.v1.operator;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static com.blinc.xpos.TestJwtFactory.operatorJwt;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
 * Ensures Standard Stock Count: ledger-based Opening/System, same-day Added, and Total = Opening +
 * Added + stock-take (e.g. 7 prior-day receipt + 3 today = Opening 7, Added 3, System 10).
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
    UUID priceListId = createPriceList(orgId);
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
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(grnBody))
        .andExpect(status().isCreated());
    addItemToPriceList(orgId, priceListId, itemId);

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
                    .content("{\"priceListId\":\"" + priceListId + "\"}"))
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
        .andExpect(jsonPath("$.rows[0].openingStock").value(0))
        .andExpect(jsonPath("$.rows[0].systemCountBeforeToday").value(9));
  }

  @Test
  void getSheetOpeningPlusSameDayAddedMatchesTwoReceiptDays() throws Exception {
    ZoneId zone = ZoneId.of("Africa/Nairobi");
    LocalDate businessDay = LocalDate.now(zone);
    Instant priorDayInstant =
        businessDay.minusDays(1).atTime(LocalTime.of(14, 0)).atZone(zone).toInstant();
    Timestamp priorTs = Timestamp.from(priorDayInstant);

    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID priceListId = createPriceList(orgId);
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
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(grn7))
            .andExpect(status().isCreated())
            .andReturn();
    addItemToPriceList(orgId, priceListId, itemId);
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
                .with(adminJwt())
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
        .andExpect(jsonPath("$.rows[0].addedStock").value(3))
        .andExpect(jsonPath("$.rows[0].systemCountBeforeToday").value(10));
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

  private UUID createPriceList(UUID orgId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-lists")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"name\":\"Default\",\"priority\":0,\"active\":true}"))
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

  private UUID createItem(UUID orgId) throws Exception {
    UUID taxProfileId = createTaxProfile(orgId);
    String body =
        """
        {"name":"SKU-A","itemType":"STOCK","taxProfileId":"%s","trackInventory":true,"active":true}
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

  private void addItemToPriceList(UUID orgId, UUID priceListId, UUID itemId) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"itemId\":\"" + itemId + "\",\"price\":99.50,\"currency\":\"KES\"}"))
        .andExpect(status().isCreated());
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
