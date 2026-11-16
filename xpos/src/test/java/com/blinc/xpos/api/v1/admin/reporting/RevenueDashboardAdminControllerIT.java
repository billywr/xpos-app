package com.blinc.xpos.api.v1.admin.reporting;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static org.springframework.http.MediaType.APPLICATION_JSON;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class RevenueDashboardAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void getRevenueDashboardReturnsSummaryAndTrend() throws Exception {
    UUID orgId = createOrg("Revenue Dashboard Org A");
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/revenue-dashboard"
                    + "?startDate=2025-02-01&endDate=2025-02-28")
                .with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.summary.orgId").value(orgId.toString()))
        .andExpect(jsonPath("$.summary.branchId").value(branchId.toString()))
        .andExpect(jsonPath("$.summary.startDate").value("2025-02-01"))
        .andExpect(jsonPath("$.summary.endDate").value("2025-02-28"))
        .andExpect(jsonPath("$.summary.revenueTotal").value(0))
        .andExpect(jsonPath("$.summary.taxTotal").value(0))
        .andExpect(jsonPath("$.summary.cogsTotal").value(0))
        .andExpect(jsonPath("$.summary.expenseTotal").value(0))
        .andExpect(jsonPath("$.summary.netProfit").value(0))
        .andExpect(jsonPath("$.summary.saleCount").value(0))
        .andExpect(jsonPath("$.trend").isArray())
        .andExpect(jsonPath("$.trend.length()").value(0));
  }

  @Test
  void getRevenueDashboardOtherOrgBranchReturns404() throws Exception {
    UUID orgId = createOrg("Revenue Dashboard Org B");
    UUID otherOrgId = createOrg("Revenue Dashboard Org C");
    UUID businessId = createBusiness(otherOrgId);
    UUID otherBranchId = createBranch(otherOrgId, businessId);

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/"
                    + orgId
                    + "/branches/"
                    + otherBranchId
                    + "/revenue-dashboard?startDate=2025-02-01&endDate=2025-02-28")
                .with(adminJwt()))
        .andExpect(status().isNotFound());
  }

  @Test
  void getRevenueDashboardEndBeforeStartReturns400() throws Exception {
    UUID orgId = createOrg("Revenue Dashboard Org D");
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/revenue-dashboard"
                    + "?startDate=2025-02-28&endDate=2025-02-01")
                .with(adminJwt()))
        .andExpect(status().isBadRequest());
  }

  @Test
  void getRevenueDashboardMissingStartDateReturns400() throws Exception {
    UUID orgId = createOrg("Revenue Dashboard Org E");
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/revenue-dashboard"
                    + "?endDate=2025-02-28")
                .with(adminJwt()))
        .andExpect(status().isBadRequest());
  }

  private UUID createOrg(String name) throws Exception {
    String uniqueName = name + " " + UUID.randomUUID().toString().substring(0, 8);
    String body = objectMapper.writeValueAsString(new OrgCreateRequest(uniqueName));
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
}
