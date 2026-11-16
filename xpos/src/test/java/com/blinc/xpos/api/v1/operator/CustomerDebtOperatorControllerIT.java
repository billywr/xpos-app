package com.blinc.xpos.api.v1.operator;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static com.blinc.xpos.TestJwtFactory.operatorJwt;
import static org.springframework.http.MediaType.APPLICATION_JSON;
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
class CustomerDebtOperatorControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void createDebtThenList() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID customerId = createCustomer(orgId);

    String createBody =
        """
        {"customerId":"%s","amount":1500.50,"dueDate":"2025-04-01","notes":"Credit sale"}
        """
            .formatted(customerId);

    mockMvc
        .perform(
            post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(createBody))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").exists())
        .andExpect(jsonPath("$.customerId").value(customerId.toString()))
        .andExpect(jsonPath("$.customerName").exists())
        .andExpect(jsonPath("$.amount").value(1500.50))
        .andExpect(jsonPath("$.amountSettled").value(0))
        .andExpect(jsonPath("$.outstanding").value(1500.50))
        .andExpect(jsonPath("$.status").value("OPEN"))
        .andExpect(jsonPath("$.notes").value("Credit sale"))
        .andExpect(jsonPath("$.issuedBy").doesNotExist())
        .andExpect(jsonPath("$.createdByStaffUserId").exists())
        .andExpect(jsonPath("$.createdAt").exists());

    mockMvc
        .perform(
            get("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                .with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.content[0].amount").value(1500.50))
        .andExpect(jsonPath("$.content[0].status").value("OPEN"));
  }

  @Test
  void createDebtWithIssuedByThenUpdateIssuedBy() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID customerId = createCustomer(orgId);

    String createBody =
        """
        {"customerId":"%s","amount":200,"issuedBy":"Jane Doe"}
        """
            .formatted(customerId);

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.issuedBy").value("Jane Doe"))
            .andReturn();

    UUID debtId =
        UUID.fromString(
            objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    mockMvc
        .perform(
            patch("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts/" + debtId)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"issuedBy\":\"John Kamau\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.issuedBy").value("John Kamau"));
  }

  @Test
  void pendingTotalMatchesOpenAndPartialOutstanding() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID customerId = createCustomer(orgId);

    mockMvc
        .perform(
            get("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts/pending-total")
                .with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalPending").value(0));

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"customerId\":\"" + customerId + "\",\"amount\":100}"))
            .andExpect(status().isCreated())
            .andReturn();

    UUID debtId =
        UUID.fromString(
            objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    mockMvc
        .perform(
            get("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts/pending-total")
                .with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalPending").value(100));

    mockMvc
        .perform(
            post("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/debts/"
                    + debtId
                    + "/settle")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"paymentAmount\":25}"))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            get("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts/pending-total")
                .with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalPending").value(75));
  }

  @Test
  void createDebtWithInvalidCustomerReturns404() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID fakeCustomerId = UUID.randomUUID();

    String createBody =
        """
        {"customerId":"%s","amount":100}
        """.formatted(fakeCustomerId);

    mockMvc
        .perform(
            post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(createBody))
        .andExpect(status().isNotFound());
  }

  @Test
  void createDebtWithInvalidAmountReturns400() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID customerId = createCustomer(orgId);

    String createBody =
        """
        {"customerId":"%s","amount":0}
        """.formatted(customerId);

    mockMvc
        .perform(
            post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(createBody))
        .andExpect(status().isBadRequest());
  }

  @Test
  void settleDebtPartialAndFull() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID customerId = createCustomer(orgId);

    String createBody =
        """
        {"customerId":"%s","amount":1000}
        """.formatted(customerId);

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andReturn();

    UUID debtId =
        UUID.fromString(
            objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    String settlePartialBody = "{\"paymentAmount\":400}";
    mockMvc
        .perform(
            post("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/debts/"
                    + debtId
                    + "/settle")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(settlePartialBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.amountSettled").value(400))
        .andExpect(jsonPath("$.outstanding").value(600))
        .andExpect(jsonPath("$.status").value("PARTIAL"));

    String settleFullBody = "{\"paymentAmount\":600}";
    mockMvc
        .perform(
            post("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/debts/"
                    + debtId
                    + "/settle")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(settleFullBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.amountSettled").value(1000))
        .andExpect(jsonPath("$.outstanding").value(0))
        .andExpect(jsonPath("$.status").value("CLOSED"));
  }

  @Test
  void settleBulkAllocatesOldestFirstPartialOnLast() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID customerId = createCustomer(orgId);

    createDebt(orgId, branchId, customerId, 10, "2025-01-01T10:00:00Z");
    createDebt(orgId, branchId, customerId, 50, "2025-01-02T10:00:00Z");
    createDebt(orgId, branchId, customerId, 100, "2025-01-03T10:00:00Z");

    mockMvc
        .perform(
            post(bulkSettleUrl(orgId, branchId, customerId))
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"paymentAmount\":90}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.paymentAmount").value(90))
        .andExpect(jsonPath("$.totalApplied").value(90))
        .andExpect(jsonPath("$.unallocated").value(0))
        .andExpect(jsonPath("$.allocations.length()").value(3))
        .andExpect(jsonPath("$.allocations[0].appliedAmount").value(10))
        .andExpect(jsonPath("$.allocations[0].outstandingAfter").value(0))
        .andExpect(jsonPath("$.allocations[0].status").value("CLOSED"))
        .andExpect(jsonPath("$.allocations[1].appliedAmount").value(50))
        .andExpect(jsonPath("$.allocations[1].outstandingAfter").value(0))
        .andExpect(jsonPath("$.allocations[1].status").value("CLOSED"))
        .andExpect(jsonPath("$.allocations[2].appliedAmount").value(30))
        .andExpect(jsonPath("$.allocations[2].outstandingAfter").value(70))
        .andExpect(jsonPath("$.allocations[2].status").value("PARTIAL"));
  }

  @Test
  void settleBulkClearsAllWhenExactTotal() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID customerId = createCustomer(orgId);

    createDebt(orgId, branchId, customerId, 10, "2025-01-01T10:00:00Z");
    createDebt(orgId, branchId, customerId, 50, "2025-01-02T10:00:00Z");

    mockMvc
        .perform(
            post(bulkSettleUrl(orgId, branchId, customerId))
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"paymentAmount\":60}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalApplied").value(60))
        .andExpect(jsonPath("$.allocations.length()").value(2))
        .andExpect(jsonPath("$.allocations[0].status").value("CLOSED"))
        .andExpect(jsonPath("$.allocations[1].status").value("CLOSED"));
  }

  @Test
  void settleBulkRejectsOverpayment() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID customerId = createCustomer(orgId);

    createDebt(orgId, branchId, customerId, 10, "2025-01-01T10:00:00Z");

    mockMvc
        .perform(
            post(bulkSettleUrl(orgId, branchId, customerId))
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"paymentAmount\":11}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("PAYMENT_EXCEEDS_TOTAL"));
  }

  @Test
  void settleBulkSingleDebtSameAsSettle() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID customerId = createCustomer(orgId);

    UUID debtId = createDebt(orgId, branchId, customerId, 100, "2025-01-01T10:00:00Z");

    mockMvc
        .perform(
            post(bulkSettleUrl(orgId, branchId, customerId))
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"paymentAmount\":40}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.allocations.length()").value(1))
        .andExpect(jsonPath("$.allocations[0].debtId").value(debtId.toString()))
        .andExpect(jsonPath("$.allocations[0].appliedAmount").value(40))
        .andExpect(jsonPath("$.allocations[0].outstandingAfter").value(60))
        .andExpect(jsonPath("$.allocations[0].status").value("PARTIAL"));
  }

  @Test
  void settleBulkIncludesPartialDebtOldestFirst() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID customerId = createCustomer(orgId);

    UUID oldestDebtId = createDebt(orgId, branchId, customerId, 100, "2025-01-01T10:00:00Z");
    mockMvc
        .perform(
            post("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/debts/"
                    + oldestDebtId
                    + "/settle")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"paymentAmount\":30}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("PARTIAL"))
        .andExpect(jsonPath("$.outstanding").value(70));

    createDebt(orgId, branchId, customerId, 50, "2025-01-02T10:00:00Z");

    mockMvc
        .perform(
            post(bulkSettleUrl(orgId, branchId, customerId))
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"paymentAmount\":100}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.allocations.length()").value(2))
        .andExpect(jsonPath("$.allocations[0].debtId").value(oldestDebtId.toString()))
        .andExpect(jsonPath("$.allocations[0].appliedAmount").value(70))
        .andExpect(jsonPath("$.allocations[0].outstandingAfter").value(0))
        .andExpect(jsonPath("$.allocations[1].appliedAmount").value(30))
        .andExpect(jsonPath("$.allocations[1].outstandingAfter").value(20))
        .andExpect(jsonPath("$.allocations[1].status").value("PARTIAL"));
  }

  @Test
  void settleBulkByNameAllocatesAcrossDuplicateCustomerRecords() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    UUID customerA = createCustomerNamed(orgId, "Peter");
    UUID customerB = createCustomerNamed(orgId, "Peter");
    createDebtForCustomer(orgId, branchId, customerA, 10, "2025-01-01T10:00:00Z");
    createDebtForCustomer(orgId, branchId, customerB, 50, "2025-01-02T10:00:00Z");
    createDebtForCustomer(orgId, branchId, customerB, 100, "2025-01-03T10:00:00Z");

    mockMvc
        .perform(
            post("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/debts/settle-bulk-by-name")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"customerName\":\"Peter\",\"paymentAmount\":90}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalApplied").value(90))
        .andExpect(jsonPath("$.allocations.length()").value(3))
        .andExpect(jsonPath("$.allocations[2].outstandingAfter").value(70));
  }

  @Test
  void updateDebtBalanceRecordsRepayment() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID customerId = createCustomer(orgId);

    String createBody =
        """
        {"customerId":"%s","amount":70}
        """.formatted(customerId);

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andReturn();

    UUID debtId =
        UUID.fromString(
            objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    String updateBalanceBody = "{\"outstanding\":50,\"notes\":\"Paid 20\"}";
    mockMvc
        .perform(
            patch("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts/" + debtId)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(updateBalanceBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.amount").value(70))
        .andExpect(jsonPath("$.amountSettled").value(20))
        .andExpect(jsonPath("$.outstanding").value(50))
        .andExpect(jsonPath("$.status").value("PARTIAL"))
        .andExpect(jsonPath("$.notes").value("Paid 20"));
  }

  @Test
  void updateDebtRejectedWhenRepaymentsExist() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID customerId = createCustomer(orgId);

    String createBody =
        """
        {"customerId":"%s","amount":100}
        """.formatted(customerId);

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andReturn();

    UUID debtId =
        UUID.fromString(
            objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    mockMvc
        .perform(
            post("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/debts/"
                    + debtId
                    + "/settle")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"paymentAmount\":20}"))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            patch("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts/" + debtId)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"outstanding\":70,\"notes\":\"Adjust\"}"))
        .andExpect(status().isBadRequest());

    mockMvc
        .perform(
            post("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/debts/"
                    + debtId
                    + "/cancel")
                .with(operatorJwt()))
        .andExpect(status().isBadRequest());
  }

  @Test
  void updateDebtAndCancel() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID customerId = createCustomer(orgId);

    String createBody =
        """
        {"customerId":"%s","amount":500,"dueDate":"2025-05-01","notes":"Original"}
        """
            .formatted(customerId);

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andReturn();

    UUID debtId =
        UUID.fromString(
            objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    String updateBody = "{\"amount\":600,\"dueDate\":\"2025-06-15\",\"notes\":\"Updated\"}";
    mockMvc
        .perform(
            patch("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts/" + debtId)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(updateBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.amount").value(600))
        .andExpect(jsonPath("$.notes").value("Updated"));

    mockMvc
        .perform(
            post("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/debts/"
                    + debtId
                    + "/cancel")
                .with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("CANCELLED"));

    mockMvc
        .perform(
            get("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                .with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.content[0].status").value("CANCELLED"));
  }

  @Test
  void updateDebtCustomerAndAmountAndBalanceTogether() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID customerId = createCustomer(orgId);

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"customerId\":\"" + customerId + "\",\"amount\":100}"))
            .andExpect(status().isCreated())
            .andReturn();

    UUID debtId =
        UUID.fromString(
            objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    String updateBody =
        "{\"customerName\":\"Jane Wanjiku\",\"customerPhone\":\"+254700111222\","
            + "\"amount\":250,\"outstanding\":200,\"notes\":\"Corrected totals\"}";

    mockMvc
        .perform(
            patch("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts/" + debtId)
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(updateBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.customerName").value("Jane Wanjiku"))
        .andExpect(jsonPath("$.customerPhone").value("+254700111222"))
        .andExpect(jsonPath("$.amount").value(250))
        .andExpect(jsonPath("$.amountSettled").value(50))
        .andExpect(jsonPath("$.outstanding").value(200))
        .andExpect(jsonPath("$.status").value("PARTIAL"))
        .andExpect(jsonPath("$.notes").value("Corrected totals"));
  }

  @Test
  void listDebtsWithStatusFilterOpenReturnsOnlyOpenDebts() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID customerId = createCustomer(orgId);

    mockMvc
        .perform(
            post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"customerId\":\"" + customerId + "\",\"amount\":100}"))
        .andExpect(status().isCreated());

    mockMvc
        .perform(
            get("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts?status=OPEN")
                .with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.content[0].status").value("OPEN"));
  }

  @Test
  void listDebtsWithStatusFilterSettledExcludesOpen() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID customerId = createCustomer(orgId);

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"customerId\":\"" + customerId + "\",\"amount\":50}"))
            .andExpect(status().isCreated())
            .andReturn();

    UUID debtId =
        UUID.fromString(
            objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    mockMvc
        .perform(
            post("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/debts/"
                    + debtId
                    + "/settle")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"paymentAmount\":50}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("CLOSED"));

    mockMvc
        .perform(
            get("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts?status=OPEN")
                .with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(0));

    mockMvc
        .perform(
            get("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts?status=CLOSED")
                .with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.content[0].status").value("CLOSED"));
  }

  @Test
  void listDebtsWithStatusFilterPartialReturnsOnlyPartialDebts() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID customerId = createCustomer(orgId);

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"customerId\":\"" + customerId + "\",\"amount\":80}"))
            .andExpect(status().isCreated())
            .andReturn();

    UUID debtId =
        UUID.fromString(
            objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    mockMvc
        .perform(
            post("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/debts/"
                    + debtId
                    + "/settle")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"paymentAmount\":30}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("PARTIAL"));

    mockMvc
        .perform(
            get("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/debts?status=PARTIAL")
                .with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.content[0].status").value("PARTIAL"));
  }

  @Test
  void listDebtsWithStatusFilterCancelledReturnsOnlyCancelledDebts() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID customerId = createCustomer(orgId);

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"customerId\":\"" + customerId + "\",\"amount\":90}"))
            .andExpect(status().isCreated())
            .andReturn();

    UUID debtId =
        UUID.fromString(
            objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    mockMvc
        .perform(
            post("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/debts/"
                    + debtId
                    + "/cancel")
                .with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("CANCELLED"));

    mockMvc
        .perform(
            get("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/debts?status=CANCELLED")
                .with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.content[0].status").value("CANCELLED"));
  }

  @Test
  void listDebtsWithMultipleStatusesReturnsMatchingDebts() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID customerId = createCustomer(orgId);

    mockMvc
        .perform(
            post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"customerId\":\"" + customerId + "\",\"amount\":60}"))
        .andExpect(status().isCreated());

    MvcResult create2 =
        mockMvc
            .perform(
                post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"customerId\":\"" + customerId + "\",\"amount\":40}"))
            .andExpect(status().isCreated())
            .andReturn();

    UUID debt2Id =
        UUID.fromString(
            objectMapper.readTree(create2.getResponse().getContentAsString()).get("id").asText());
    mockMvc
        .perform(
            post("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/debts/"
                    + debt2Id
                    + "/settle")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"paymentAmount\":40}"))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            get("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/debts?status=OPEN&status=SETTLED")
                .with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(2));
  }

  @Test
  void listDebtsWithoutStatusParamReturnsAll() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID customerId = createCustomer(orgId);

    mockMvc
        .perform(
            post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"customerId\":\"" + customerId + "\",\"amount\":200}"))
        .andExpect(status().isCreated());

    mockMvc
        .perform(
            get("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                .with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.content[0].status").value("OPEN"));
  }

  @Test
  void listDebtsOtherOrgBranchReturns403Or404() throws Exception {
    UUID orgId = createOrg();
    UUID otherOrgId = createOrg();
    UUID businessId = createBusiness(otherOrgId);
    UUID otherBranchId = createBranch(otherOrgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, createBranch(orgId, createBusiness(orgId)));

    mockMvc
        .perform(
            get("/api/v1/operator/orgs/" + orgId + "/branches/" + otherBranchId + "/debts")
                .with(operatorJwt()))
        .andExpect(status().isNotFound());
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(new OrgCreateRequest("Debt Test Org " + UUID.randomUUID()));
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
    String body = "{\"iamUserId\":\"operator\",\"username\":\"operator\"}";
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
    String body = "{\"branchId\":\"" + branchId + "\",\"primary\":true}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/staff-users/" + staffUserId + "/branches")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }

  private UUID createCustomer(UUID orgId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/customers")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"name\":\"John Doe\",\"phone\":\"+254700000001\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private static String bulkSettleUrl(UUID orgId, UUID branchId, UUID customerId) {
    return "/api/v1/operator/orgs/"
        + orgId
        + "/branches/"
        + branchId
        + "/customers/"
        + customerId
        + "/debts/settle-bulk";
  }

  private UUID createDebt(
      UUID orgId, UUID branchId, UUID customerId, double amount, String createdAt)
      throws Exception {
    String createBody =
        """
        {"customerId":"%s","amount":%s,"createdAt":"%s"}
        """
            .formatted(customerId, amount, createdAt);
    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createDebtForCustomer(
      UUID orgId, UUID branchId, UUID customerId, double amount, String createdAt)
      throws Exception {
    return createDebt(orgId, branchId, customerId, amount, createdAt);
  }

  private UUID createCustomerNamed(UUID orgId, String name) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/customers")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"name\":\"" + name + "\",\"phone\":\"+254700000001\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }
}
