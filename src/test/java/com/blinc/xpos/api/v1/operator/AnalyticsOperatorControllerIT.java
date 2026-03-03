package com.blinc.xpos.api.v1.operator;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

/**
 * Integration test for Operator Analytics API: snapshot endpoint. Requires Postgres
 * (Testcontainers). Uses JWT mock with subject "admin" for operator calls.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AnalyticsOperatorControllerIT extends AbstractIntegrationTest {

  @Autowired
  private MockMvc mockMvc;
  @Autowired
  private ObjectMapper objectMapper;

  @Test
  @Timeout(10)
  void getSnapshotReturnsFullStructureWhenBranchExists() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    String url = "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/analytics/snapshot";

    mockMvc
        .perform(get(url).with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.businessDate").exists())
        .andExpect(jsonPath("$.timezone").value("Africa/Nairobi"))
        .andExpect(jsonPath("$.summary").exists())
        .andExpect(jsonPath("$.summary.todayRevenue").exists())
        .andExpect(jsonPath("$.summary.todaySaleCount").exists())
        .andExpect(jsonPath("$.summary.todayAvgTicket").exists())
        .andExpect(jsonPath("$.summary.todayTaxTotal").exists())
        .andExpect(jsonPath("$.openShift").exists())
        .andExpect(jsonPath("$.openShift.hasOpenShift").isBoolean())
        .andExpect(jsonPath("$.hourlyTrend").isArray())
        .andExpect(jsonPath("$.topItems").isArray())
        .andExpect(jsonPath("$.paymentBreakdown").isArray())
        .andExpect(jsonPath("$.last7DaysTrend").isArray())
        .andExpect(jsonPath("$.comparison").exists())
        .andExpect(jsonPath("$.comparison.previousPeriodRevenue").exists())
        .andExpect(jsonPath("$.comparison.percentChange").exists())
        .andExpect(jsonPath("$.debtIntelligence").exists())
        .andExpect(jsonPath("$.debtIntelligence.totalOutstanding").exists())
        .andExpect(jsonPath("$.debtIntelligence.overdueAmount").exists())
        .andExpect(jsonPath("$.debtIntelligence.openDebtCount").exists())
        .andExpect(jsonPath("$.expenseIntelligence").exists())
        .andExpect(jsonPath("$.expenseIntelligence.todayTotal").exists())
        .andExpect(jsonPath("$.expenseIntelligence.byCategory").isArray())
        .andExpect(jsonPath("$.fetchedAt").exists());
  }

  @Test
  void getSnapshotOtherOrgBranchReturns403() throws Exception {
    UUID orgId = createOrg();
    UUID otherOrgId = createOrg();
    UUID businessId = createBusiness(otherOrgId);
    UUID otherBranchId = createBranch(otherOrgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, createBranch(orgId, createBusiness(orgId)));

    String url =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + otherBranchId + "/analytics/snapshot";

    mockMvc
        .perform(get(url).with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isNotFound());
  }

  @Test
  void getSnapshotWhenStaffNotInOrgReturns404() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    // No staff user created for this org - "admin" has no staff record here

    String url = "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/analytics/snapshot";

    mockMvc
        .perform(get(url).with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isNotFound());
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Analytics Test Org " + UUID.randomUUID()));
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return objectMapper.readValue(result.getResponse().getContentAsString(), OrgResponse.class).id();
  }

  private UUID createBusiness(UUID orgId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/businesses")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content("{\"legalName\":\"Biz\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createBranch(UUID orgId, UUID businessId) throws Exception {
    String body =
        "{\"businessId\":\"" + businessId + "\",\"name\":\"B1\","
            + "\"timezone\":\"Africa/Nairobi\",\"currency\":\"KES\"}";
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/branches")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createStaffUser(UUID orgId) throws Exception {
    String body = """
        {"iamUserId":"admin","username":"admin"}
        """;
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/staff-users")
                    .with(jwt().jwt(j -> j.subject("admin")))
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
        """
        .formatted(branchId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/staff-users/" + staffUserId + "/branches")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }
}
