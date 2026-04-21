package com.blinc.xpos.api.v1.operator;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static com.blinc.xpos.TestJwtFactory.noRoleJwt;
import static com.blinc.xpos.TestJwtFactory.operatorJwt;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Integration tests for the Sales Recording draft endpoints. Covers empty-load, upsert round-trip,
 * idempotent delete, auto-clear on recording, and auth enforcement.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SalesRecordingDraftOperatorControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void getReturnsEmptyWhenNoDraftExists() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID terminalId = createTerminal(orgId, branchId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    String base = draftBase(orgId, branchId, terminalId);
    mockMvc
        .perform(get(base + "?date=" + LocalDate.now()).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.exists").value(false))
        .andExpect(jsonPath("$.qtyByItem").isMap())
        .andExpect(jsonPath("$.qtyByItem.length()").value(0))
        .andExpect(jsonPath("$.updatedAt").doesNotExist());
  }

  @Test
  void putThenGetRoundTripsTheDraft() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID terminalId = createTerminal(orgId, branchId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID itemAId = createUntrackedItem(orgId);
    UUID itemBId = createUntrackedItem(orgId);

    String base = draftBase(orgId, branchId, terminalId);
    LocalDate today = LocalDate.now();
    String body =
        """
        {"saleDate":"%s","qtyByItem":{"%s":"2.5","%s":"1"}}
        """
            .formatted(today, itemAId, itemBId);

    mockMvc
        .perform(put(base).with(operatorJwt()).contentType(APPLICATION_JSON).content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.exists").value(true))
        .andExpect(jsonPath("$.qtyByItem." + itemAId).value("2.5"))
        .andExpect(jsonPath("$.qtyByItem." + itemBId).value("1"))
        .andExpect(jsonPath("$.updatedAt").isString());

    mockMvc
        .perform(get(base + "?date=" + today).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.exists").value(true))
        .andExpect(jsonPath("$.qtyByItem." + itemAId).value("2.5"))
        .andExpect(jsonPath("$.qtyByItem." + itemBId).value("1"));
  }

  @Test
  void emptyPutClearsExistingDraft() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID terminalId = createTerminal(orgId, branchId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID itemId = createUntrackedItem(orgId);

    String base = draftBase(orgId, branchId, terminalId);
    LocalDate today = LocalDate.now();

    mockMvc
        .perform(
            put(base)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"saleDate":"%s","qtyByItem":{"%s":"3"}}
                    """
                        .formatted(today, itemId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.exists").value(true));

    mockMvc
        .perform(
            put(base)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"saleDate":"%s","qtyByItem":{}}
                    """
                        .formatted(today)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.exists").value(false));

    mockMvc
        .perform(get(base + "?date=" + today).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.exists").value(false));
  }

  @Test
  void deleteIsIdempotent() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID terminalId = createTerminal(orgId, branchId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    String base = draftBase(orgId, branchId, terminalId);
    LocalDate today = LocalDate.now();

    mockMvc
        .perform(delete(base + "?date=" + today).with(operatorJwt()))
        .andExpect(status().isNoContent());
    mockMvc
        .perform(delete(base + "?date=" + today).with(operatorJwt()))
        .andExpect(status().isNoContent());
  }

  @Test
  void recordingABatchAutoClearsTheDraft() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID terminalId = createTerminal(orgId, branchId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID itemId = createUntrackedItem(orgId);

    LocalDate today = LocalDate.now();
    String draftBase = draftBase(orgId, branchId, terminalId);
    String recordBase = recordingBase(orgId, branchId, terminalId);

    mockMvc
        .perform(
            put(draftBase)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"saleDate":"%s","qtyByItem":{"%s":"2.5"}}
                    """
                        .formatted(today, itemId)))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            post(recordBase)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"saleDate":"%s","entries":[{"itemId":"%s","qty":2.5}]}
                    """
                        .formatted(today, itemId)))
        .andExpect(status().isCreated());

    mockMvc
        .perform(get(draftBase + "?date=" + today).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.exists").value(false))
        .andExpect(jsonPath("$.qtyByItem.length()").value(0));
  }

  @Test
  void rejectsFutureAndTooOldDates() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID terminalId = createTerminal(orgId, branchId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    String base = draftBase(orgId, branchId, terminalId);
    LocalDate future = LocalDate.now().plusDays(1);
    LocalDate tooOld = LocalDate.now().minusDays(10);

    mockMvc
        .perform(get(base + "?date=" + future).with(operatorJwt()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("SALE_DATE_FUTURE"));

    mockMvc
        .perform(get(base + "?date=" + tooOld).with(operatorJwt()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("SALE_DATE_TOO_OLD"));
  }

  @Test
  void noRoleIsForbidden() throws Exception {
    UUID fakeOrgId = UUID.randomUUID();
    UUID fakeBranchId = UUID.randomUUID();
    UUID fakeTerminalId = UUID.randomUUID();
    mockMvc
        .perform(
            get(draftBase(fakeOrgId, fakeBranchId, fakeTerminalId) + "?date=" + LocalDate.now())
                .with(noRoleJwt()))
        .andExpect(status().isForbidden());
  }

  // ---- helpers (inlined to keep IT self-contained) ----

  private String draftBase(UUID orgId, UUID branchId, UUID terminalId) {
    return recordingBase(orgId, branchId, terminalId) + "/draft";
  }

  private String recordingBase(UUID orgId, UUID branchId, UUID terminalId) {
    return "/api/v1/operator/orgs/"
        + orgId
        + "/branches/"
        + branchId
        + "/terminals/"
        + terminalId
        + "/sales-recording";
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Test Org for Sales Recording Drafts " + UUID.randomUUID()));
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
    String body =
        ("{\"name\":\"VAT Standard %s\",\"vatCategory\":\"STANDARD\","
                + "\"serviceChargeRate\":0,\"levyRate\":0}")
            .formatted(UUID.randomUUID());
    MvcResult r =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/tax-profiles")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createUntrackedItem(UUID orgId) throws Exception {
    UUID taxProfileId = createTaxProfile(orgId);
    String body =
        ("""
            {"name":"Test Product","itemType":"STOCK","taxProfileId":"%s",\
            "trackInventory":false,"active":true,\
            "buyingPrice":80.00,"defaultSellingPrice":99.50,"visibleInPos":true}
            """)
            .formatted(taxProfileId);
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
