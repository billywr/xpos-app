package com.blinc.xpos.api.v1.admin.inventory;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
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
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/** Integration test for Stock Taking Schedule admin API. */
@SpringBootTest
@AutoConfigureMockMvc
class StockTakingScheduleAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void createGetUpdateDeleteSchedule() throws Exception {
    UUID orgId = createOrg();
    UUID branchId = createBranch(orgId);

    String createBody =
        """
        {"branchId":"%s","frequency":"DAILY","scheduledHour":6,"scheduledMinute":0}
        """
            .formatted(branchId);
    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/stock-taking-schedules")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.frequency").value("DAILY"))
            .andExpect(jsonPath("$.scheduledHour").value(6))
            .andExpect(jsonPath("$.isActive").value(true))
            .andReturn();
    UUID scheduleId =
        UUID.fromString(
            objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/stock-taking-schedules/" + scheduleId)
                .with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.frequency").value("DAILY"));

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/stock-taking-schedules/by-branch")
                .param("branchId", branchId.toString())
                .with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(scheduleId.toString()));

    String updateBody =
        """
        {"frequency":"WEEKLY","dayOfWeek":1,"scheduledHour":7,"scheduledMinute":30,"isActive":true}
        """;
    mockMvc
        .perform(
            put("/api/v1/admin/orgs/" + orgId + "/stock-taking-schedules/" + scheduleId)
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(updateBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.frequency").value("WEEKLY"))
        .andExpect(jsonPath("$.dayOfWeek").value(1))
        .andExpect(jsonPath("$.scheduledHour").value(7));

    mockMvc
        .perform(
            delete("/api/v1/admin/orgs/" + orgId + "/stock-taking-schedules/" + scheduleId)
                .with(adminJwt()))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/stock-taking-schedules/by-branch")
                .param("branchId", branchId.toString())
                .with(adminJwt()))
        .andExpect(status().isNotFound());
  }

  @Test
  void listSchedulesAndTriggerCreatesSession() throws Exception {
    UUID orgId = createOrg();
    UUID branchId = createBranch(orgId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID itemId = createItem(orgId);

    String createBody =
        """
        {"branchId":"%s","frequency":"DAILY","scheduledHour":6,"scheduledMinute":0}
        """
            .formatted(branchId);
    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/stock-taking-schedules")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andReturn();
    UUID scheduleId =
        UUID.fromString(
            objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId + "/stock-taking-schedules").with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.content[0].frequency").value("DAILY"));

    MvcResult triggerResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/"
                        + orgId
                        + "/stock-taking-schedules/"
                        + scheduleId
                        + "/trigger")
                    .with(adminJwt()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.status").value("OPEN"))
            .andExpect(jsonPath("$.sourceType").value("SCHEDULED"))
            .andReturn();
    UUID sessionId =
        UUID.fromString(
            objectMapper
                .readTree(triggerResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    String addLineBody = """
        {"itemId":"%s","countedQty":5}
        """.formatted(itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/stock-count-sessions/" + sessionId + "/lines")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(addLineBody))
        .andExpect(status().isOk());
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
    UUID taxProfileId = createTaxProfile(orgId);
    String body =
        """
        {"name":"Widget","itemType":"STOCK","taxProfileId":"%s","trackInventory":true,"active":true}
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

  private UUID createTaxProfile(UUID orgId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/tax-profiles")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(
                        "{\"name\":\"VAT\",\"vatCategory\":\"STANDARD\",\"serviceChargeRate\":0,"
                            + "\"levyRate\":0}"))
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

  @Test
  void createScheduleConflictWhenOneExistsForBranch() throws Exception {
    UUID orgId = createOrg();
    UUID branchId = createBranch(orgId);

    String body =
        """
        {"branchId":"%s","frequency":"DAILY","scheduledHour":6,"scheduledMinute":0}
        """
            .formatted(branchId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/stock-taking-schedules")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());

    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/stock-taking-schedules")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isConflict());
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Test Org StockTaking " + UUID.randomUUID()));
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

  private UUID createBranch(UUID orgId) throws Exception {
    UUID businessId = createBusiness(orgId);
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
}
