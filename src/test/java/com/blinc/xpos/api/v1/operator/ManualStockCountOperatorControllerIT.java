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
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class ManualStockCountOperatorControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;

  @Autowired private ObjectMapper objectMapper;

  @Test
  void getSheetReturnsEmptyRowsWhenNoData() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    LocalDate d = LocalDate.now(ZoneId.of("Africa/Nairobi"));
    String url =
        "/api/v1/operator/orgs/"
            + orgId
            + "/branches/"
            + branchId
            + "/manual-stock-count?date="
            + d;
    mockMvc
        .perform(get(url).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.date").value(d.toString()))
        .andExpect(jsonPath("$.rows.length()").value(0));
  }

  @Test
  void putSaveReturnsComputedTotals() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    LocalDate d = LocalDate.now(ZoneId.of("Africa/Nairobi"));
    String body =
        """
        {"date":"%s","outletId":"%s","rows":[{
          "itemName":"Lite",
          "sku":"L1",
          "openingQty":2,
          "addedQty":3,
          "addedTodayQty":1,
          "closingQty":5,
          "systemQty":5,
          "sellingPrice":110,
          "lineOrder":0
        }]}
        """
            .formatted(d, branchId);

    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/manual-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rows.length()").value(1))
        .andExpect(jsonPath("$.rows[0].totalStock").value(6))
        .andExpect(jsonPath("$.rows[0].unitsSold").value(1))
        .andExpect(jsonPath("$.rows[0].variance").value(0))
        .andExpect(jsonPath("$.rows[0].amount").value(110.0));
  }

  @Test
  void saveUsesPreviousDayClosingWhenOpeningQtyOmitted() throws Exception {
    ZoneId zone = ZoneId.of("Africa/Nairobi");
    LocalDate today = LocalDate.now(zone);
    LocalDate yesterday = today.minusDays(1);

    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID itemId = createItem(orgId);

    String saveYesterday =
        """
        {"date":"%s","outletId":"%s","rows":[{
          "itemId":"%s",
          "itemName":"Snap",
          "openingQty":0,
          "addedQty":0,
          "addedTodayQty":0,
          "closingQty":7,
          "systemQty":7,
          "sellingPrice":90,
          "lineOrder":0
        }]}
        """
            .formatted(yesterday, branchId, itemId);
    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/manual-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(saveYesterday))
        .andExpect(status().isOk());

    String saveToday =
        """
        {"date":"%s","outletId":"%s","rows":[{
          "itemId":"%s",
          "itemName":"Snap",
          "addedQty":3,
          "addedTodayQty":0,
          "closingQty":10,
          "systemQty":10,
          "sellingPrice":90,
          "lineOrder":0
        }]}
        """
            .formatted(today, branchId, itemId);
    mockMvc
        .perform(
            put("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/manual-stock-count")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(saveToday))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rows[0].openingQty").value(7))
        .andExpect(jsonPath("$.rows[0].totalStock").value(10));
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Test Org ManualStock " + UUID.randomUUID()));
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
        {"name":"SKU-M","itemType":"STOCK","taxProfileId":"%s","trackInventory":true,"active":true}
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
}
