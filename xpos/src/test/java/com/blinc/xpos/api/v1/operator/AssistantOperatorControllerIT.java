package com.blinc.xpos.api.v1.operator;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static com.blinc.xpos.TestJwtFactory.operatorJwt;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.blinc.xpos.AbstractIntegrationTest;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgCreateRequest;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class AssistantOperatorControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  @Timeout(10)
  void querySalesTodayReturnsAnswer() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    String url = "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/assistant/query";

    mockMvc
        .perform(
            post(url)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"message\":\"How many sales today?\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.answer").isString())
        .andExpect(jsonPath("$.intent").value("SALES_TODAY"))
        .andExpect(jsonPath("$.suggestions").isArray());
  }

  @Test
  void queryCatalogCountRequiresAdminAccess() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    createItem(orgId);

    String url = "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/assistant/query";

    mockMvc
        .perform(
            post(url)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"message\":\"How many items in the catalog?\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.deniedIntent").value("CATALOG_COUNT"));
  }

  @Test
  void queryCatalogCountReturnsActiveItemsForAdmin() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId, "admin", "admin");
    assignStaffToBranch(orgId, staffUserId, branchId);
    createItem(orgId);

    String url = "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/assistant/query";

    mockMvc
        .perform(
            post(url)
                .with(com.blinc.xpos.TestJwtFactory.allRolesJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"message\":\"How many items in the catalog?\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.intent").value("CATALOG_COUNT"))
        .andExpect(jsonPath("$.data.activeItemCount").value(1));
  }

  @Test
  void queryAcceptsDoubleEncodedJsonBody() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    String url = "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/assistant/query";
    String doubleEncoded =
        objectMapper.writeValueAsString(
            objectMapper.writeValueAsString(java.util.Map.of("message", "help")));

    mockMvc
        .perform(post(url).with(operatorJwt()).contentType(APPLICATION_JSON).content(doubleEncoded))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.intent").value("HELP"));
  }

  @Test
  void queryPopularDrinkThisWeekUsesWeekPeriod() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    String url = "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/assistant/query";

    mockMvc
        .perform(
            post(url)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"message\":\"popular drink this week\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.intent").value("TOP_DRINKS"))
        .andExpect(jsonPath("$.data.period").value("this week"))
        .andExpect(jsonPath("$.answer").value(containsString("this week")));
  }

  @Test
  void queryTopDebtorsReturnsRankedCustomers() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    String url = "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/assistant/query";

    mockMvc
        .perform(
            post(url)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"message\":\"who has the most the debt\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.intent").value("TOP_DEBTORS"))
        .andExpect(jsonPath("$.answer").isString());
  }

  @Test
  void querySessionContextReturnsSignedInStaff() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    String url = "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/assistant/query";

    mockMvc
        .perform(
            post(url)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"message\":\"which user is logged in now\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.intent").value("SESSION_CONTEXT"))
        .andExpect(jsonPath("$.answer").value(containsString("operator")))
        .andExpect(jsonPath("$.data.staffDisplayName").value("operator"));
  }

  @Test
  void queryEmptyMessageReturns400() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    String url = "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/assistant/query";

    mockMvc
        .perform(
            post(url)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"message\":\"\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void queryReturnsRequestIdAndCitations() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    String url = "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/assistant/query";
    String requestId = UUID.randomUUID().toString();

    mockMvc
        .perform(
            post(url)
                .with(operatorJwt())
                .header("X-Request-Id", requestId)
                .contentType(APPLICATION_JSON)
                .content("{\"message\":\"sales today\",\"screen\":\"analytics\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.requestId").value(requestId))
        .andExpect(jsonPath("$.citations[0].tool").value("SALES_TODAY"))
        .andExpect(jsonPath("$.citations[0].requestId").value(requestId));
  }

  @Test
  void querySupportBundleReturnsTraceableBundle() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    String url = "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/assistant/query";

    mockMvc
        .perform(
            post(url)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"message\":\"support bundle\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.intent").value("SUPPORT_BUNDLE"))
        .andExpect(jsonPath("$.answer").value(containsString("XPOS support bundle")));
  }

  @Test
  void queryShiftVarianceRoutesToTool() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    String url = "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/assistant/query";

    mockMvc
        .perform(
            post(url)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"message\":\"shift variance\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.intent").value("SHIFT_VARIANCE"));
  }

  @Test
  void queryHelpReturnsSuggestions() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    String url = "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/assistant/query";

    mockMvc
        .perform(
            post(url)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"message\":\"help\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.intent").value("HELP"))
        .andExpect(jsonPath("$.suggestions.length()").value(7));
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(new OrgCreateRequest("Assistant Org " + UUID.randomUUID()));
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return objectMapper
        .readValue(result.getResponse().getContentAsString(), OrgResponse.class)
        .id();
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
            + "\",\"name\":\"B1\","
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
    return createStaffUser(orgId, "operator", "operator");
  }

  private UUID createStaffUser(UUID orgId, String iamUserId, String username) throws Exception {
    String body =
        """
        {"iamUserId":"%s","username":"%s"}
        """.formatted(iamUserId, username);
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/staff-users")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private void assignStaffToBranch(UUID orgId, UUID staffUserId, UUID branchId) throws Exception {
    String body = """
        {"branchId":"%s","primary":true}
        """.formatted(branchId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/staff-users/" + staffUserId + "/branches")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }

  private void createItem(UUID orgId) throws Exception {
    UUID taxProfileId = createTaxProfile(orgId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/items")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"name":"Assistant Item","itemType":"STOCK","taxProfileId":"%s",\
                    "trackInventory":true,"active":true,\
                    "buyingPrice":80.00,"defaultSellingPrice":99.50,"visibleInPos":true}
                    """
                        .formatted(taxProfileId)))
        .andExpect(status().isCreated());
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
}
