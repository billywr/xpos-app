package com.blinc.xpos.api.v1.operator;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
class MiscExpenseOperatorControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void createExpenseThenList() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    String createBody =
        """
        {"amount":250.75,"category":"UTILITIES","description":"Electricity bill","receiptRef":"INV-001"}
        """;

    mockMvc
        .perform(
            post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/misc-expenses")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(createBody))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").exists())
        .andExpect(jsonPath("$.amount").value(250.75))
        .andExpect(jsonPath("$.category").value("UTILITIES"))
        .andExpect(jsonPath("$.description").value("Electricity bill"))
        .andExpect(jsonPath("$.receiptRef").value("INV-001"))
        .andExpect(jsonPath("$.createdByStaffUserId").exists())
        .andExpect(jsonPath("$.createdAt").exists());

    mockMvc
        .perform(
            get("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/misc-expenses")
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.content[0].amount").value(250.75))
        .andExpect(jsonPath("$.content[0].category").value("UTILITIES"))
        .andExpect(jsonPath("$.totalAmount").exists());
  }

  @Test
  void updateAndCancelExpense() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    String createBody =
        """
        {"amount":100,"category":"OTHER","description":"Lunch","incurredBy":"John"}
        """;

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/misc-expenses")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andReturn();

    UUID expenseId =
        UUID.fromString(
            objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asText());

    String updateBody =
        """
        {"amount":120,"category":"OTHER","description":"Lunch updated","incurredBy":"John Doe"}
        """;

    mockMvc
        .perform(
            patch("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/misc-expenses/"
                + expenseId)
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(updateBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.amount").value(120))
        .andExpect(jsonPath("$.incurredBy").value("John Doe"));

    mockMvc
        .perform(
            post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/misc-expenses/"
                + expenseId + "/cancel")
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            get("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/misc-expenses")
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(0))
        .andExpect(jsonPath("$.totalAmount").value(0));
  }

  @Test
  void createExpenseWithInvalidAmountReturns400() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    String createBody =
        """
        {"amount":0,"category":"OTHER","description":"Test"}
        """;

    mockMvc
        .perform(
            post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/misc-expenses")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(createBody))
        .andExpect(status().isBadRequest());
  }

  @Test
  void createExpenseWithMissingDescriptionReturns400() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    String createBody =
        """
        {"amount":100,"category":"SUPPLIES","description":""}
        """;

    mockMvc
        .perform(
            post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/misc-expenses")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(createBody))
        .andExpect(status().isBadRequest());
  }

  @Test
  void listExpensesOtherOrgBranchReturns404() throws Exception {
    UUID orgId = createOrg();
    UUID otherOrgId = createOrg();
    UUID businessId = createBusiness(otherOrgId);
    UUID otherBranchId = createBranch(otherOrgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, createBranch(orgId, createBusiness(orgId)));

    mockMvc
        .perform(
            get("/api/v1/operator/orgs/" + orgId + "/branches/" + otherBranchId + "/misc-expenses")
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isNotFound());
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Expense Test Org " + UUID.randomUUID()));
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
    String body = "{\"iamUserId\":\"admin\",\"username\":\"admin\"}";
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
    String body = "{\"branchId\":\"" + branchId + "\",\"primary\":true}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/staff-users/" + staffUserId + "/branches")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }
}
