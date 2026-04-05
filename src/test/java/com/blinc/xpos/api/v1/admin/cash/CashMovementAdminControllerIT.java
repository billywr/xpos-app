package com.blinc.xpos.api.v1.admin.cash;

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
class CashMovementAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void listCashMovementsAfterCreatingMovement() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID terminalId = createTerminal(orgId, branchId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    openShift(orgId, branchId, terminalId);
    createCashMovement(orgId, branchId, terminalId);

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/cash-movements?page=0&size=10")
                .with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content").isArray())
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.content[0].type").value("PAID_IN"))
        .andExpect(jsonPath("$.content[0].amount").value(100.0));
  }

  private void createCashMovement(UUID orgId, UUID branchId, UUID terminalId) throws Exception {
    String base =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/terminals/" + terminalId;
    mockMvc
        .perform(
            post(base + "/cash-movements")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"type\":\"PAID_IN\",\"amount\":100,\"currency\":\"KES\"}"))
        .andExpect(status().isCreated());
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(new OrgCreateRequest("Test Org CashMovement Admin"));
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
        """
        {"businessId":"%s","name":"B1","timezone":"Africa/Nairobi","currency":"KES"}
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

  private UUID createTerminal(UUID orgId, UUID branchId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/branches/" + branchId + "/terminals")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"terminalCode\":\"T1\"}"))
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

  private void openShift(UUID orgId, UUID branchId, UUID terminalId) throws Exception {
    String base =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/terminals/" + terminalId;
    mockMvc
        .perform(
            post(base + "/shifts")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"openingFloatAmount\":0}"))
        .andExpect(status().isCreated());
  }
}
