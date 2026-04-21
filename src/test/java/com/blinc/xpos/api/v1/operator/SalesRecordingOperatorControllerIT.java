package com.blinc.xpos.api.v1.operator;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static com.blinc.xpos.TestJwtFactory.noRoleJwt;
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
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Integration tests for the Sales Recording operator API. Covers the happy path (untracked item),
 * validation of the backdate window, insufficient-stock rejection, stats endpoint, and auth
 * enforcement.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SalesRecordingOperatorControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void happyPathRecordsBackdatedSaleAndStatsReflectIt() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID terminalId = createTerminal(orgId, branchId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID itemId = createUntrackedItem(orgId);

    LocalDate yesterday = LocalDate.now().minusDays(1);
    String base =
        "/api/v1/operator/orgs/"
            + orgId
            + "/branches/"
            + branchId
            + "/terminals/"
            + terminalId
            + "/sales-recording";
    String body =
        """
        {"saleDate":"%s","entries":[{"itemId":"%s","qty":2.5}]}
        """
            .formatted(yesterday, itemId);

    mockMvc
        .perform(post(base).with(operatorJwt()).contentType(APPLICATION_JSON).content(body))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.saleDate").value(yesterday.toString()))
        .andExpect(jsonPath("$.createdSaleIds.length()").value(1))
        .andExpect(jsonPath("$.totalValue").value(248.75))
        .andExpect(jsonPath("$.totalItemsSold").value(2.5));

    mockMvc
        .perform(get(base + "/stats?date=" + yesterday).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.saleCount").value(1))
        .andExpect(jsonPath("$.totalSalesValue").value(248.75))
        .andExpect(jsonPath("$.topSellingItems.length()").value(1))
        .andExpect(jsonPath("$.topSellingItems[0].itemId").value(itemId.toString()))
        .andExpect(jsonPath("$.topSellingItems[0].qtySold").value(2.5));
  }

  @Test
  void rejectsFutureAndTooOldDates() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID terminalId = createTerminal(orgId, branchId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID itemId = createUntrackedItem(orgId);

    String base =
        "/api/v1/operator/orgs/"
            + orgId
            + "/branches/"
            + branchId
            + "/terminals/"
            + terminalId
            + "/sales-recording";

    LocalDate future = LocalDate.now().plusDays(1);
    mockMvc
        .perform(
            post(base)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"saleDate":"%s","entries":[{"itemId":"%s","qty":1}]}
                    """
                        .formatted(future, itemId)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("SALE_DATE_FUTURE"));

    LocalDate tooOld = LocalDate.now().minusDays(10);
    mockMvc
        .perform(
            post(base)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"saleDate":"%s","entries":[{"itemId":"%s","qty":1}]}
                    """
                        .formatted(tooOld, itemId)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("SALE_DATE_TOO_OLD"));
  }

  @Test
  void insufficientStockReturnsConflict() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID terminalId = createTerminal(orgId, branchId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID itemId = createTrackedItem(orgId);

    String base =
        "/api/v1/operator/orgs/"
            + orgId
            + "/branches/"
            + branchId
            + "/terminals/"
            + terminalId
            + "/sales-recording";

    mockMvc
        .perform(
            post(base)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"saleDate":"%s","entries":[{"itemId":"%s","qty":5}]}
                    """
                        .formatted(LocalDate.now(), itemId)))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("INSUFFICIENT_STOCK"));
  }

  @Test
  void noRoleIsForbidden() throws Exception {
    UUID fakeOrgId = UUID.randomUUID();
    UUID fakeBranchId = UUID.randomUUID();
    UUID fakeTerminalId = UUID.randomUUID();
    mockMvc
        .perform(
            get("/api/v1/operator/orgs/"
                    + fakeOrgId
                    + "/branches/"
                    + fakeBranchId
                    + "/terminals/"
                    + fakeTerminalId
                    + "/sales-recording/stats?date="
                    + LocalDate.now())
                .with(noRoleJwt()))
        .andExpect(status().isForbidden());
  }

  // ---- helpers (inlined to keep IT self-contained) ----

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Test Org for Sales Recording " + UUID.randomUUID()));
    MvcResult r =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    OrgResponse org =
        objectMapper.readValue(r.getResponse().getContentAsString(), OrgResponse.class);
    return org.id();
  }

  private UUID createBusiness(UUID orgId) throws Exception {
    MvcResult r =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/businesses")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"legalName\":\"Test Business\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createBranch(UUID orgId, UUID businessId) throws Exception {
    String body =
        """
        {"businessId":"%s","name":"Main Branch","timezone":"Africa/Nairobi","currency":"KES"}
        """
            .formatted(businessId);
    MvcResult r =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/branches")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createTerminal(UUID orgId, UUID branchId) throws Exception {
    MvcResult r =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/branches/" + branchId + "/terminals")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"terminalCode\":\"T1\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createStaffUser(UUID orgId) throws Exception {
    MvcResult r =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/staff-users")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"iamUserId\":\"operator\",\"username\":\"operator\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
  }

  private void assignStaffToBranch(UUID orgId, UUID staffUserId, UUID branchId) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/staff-users/" + staffUserId + "/branches")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"branchId\":\"%s\",\"primary\":true}".formatted(branchId)))
        .andExpect(status().isCreated());
  }

  private UUID createTaxProfile(UUID orgId) throws Exception {
    MvcResult r =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/tax-profiles")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(
                        "{\"name\":\"VAT Standard\",\"vatCategory\":\"STANDARD\","
                            + "\"serviceChargeRate\":0,\"levyRate\":0}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createUntrackedItem(UUID orgId) throws Exception {
    return createItem(orgId, false);
  }

  private UUID createTrackedItem(UUID orgId) throws Exception {
    return createItem(orgId, true);
  }

  private UUID createItem(UUID orgId, boolean trackInventory) throws Exception {
    UUID taxProfileId = createTaxProfile(orgId);
    String body =
        ("""
            {"name":"Test Product","itemType":"STOCK","taxProfileId":"%s",\
            "trackInventory":%s,"active":true,\
            "buyingPrice":80.00,"defaultSellingPrice":99.50,"visibleInPos":true}
            """)
            .formatted(taxProfileId, trackInventory);
    MvcResult r =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/items")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
  }
}
