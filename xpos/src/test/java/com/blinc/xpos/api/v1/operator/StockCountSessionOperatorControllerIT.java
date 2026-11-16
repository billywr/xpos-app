package com.blinc.xpos.api.v1.operator;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static com.blinc.xpos.TestJwtFactory.operatorJwt;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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

/** Integration test for operator stock count session API. Branch-scoped manual stock taking. */
@SpringBootTest
@AutoConfigureMockMvc
class StockCountSessionOperatorControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void operatorStartAddLineCloseSession() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID itemId = createItem(orgId);

    String base =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/stock-count-sessions";

    MvcResult startResult =
        mockMvc
            .perform(post(base).with(operatorJwt()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.status").value("OPEN"))
            .andExpect(jsonPath("$.sourceType").value("MANUAL"))
            .andReturn();
    UUID sessionId =
        UUID.fromString(
            objectMapper
                .readTree(startResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    String addLineBody = """
        {"itemId":"%s","countedQty":7}
        """.formatted(itemId);
    mockMvc
        .perform(
            post(base + "/" + sessionId + "/lines")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(addLineBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lines.length()").value(1))
        .andExpect(jsonPath("$.lines[0].countedQty").value(7));

    mockMvc
        .perform(get(base).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1));

    mockMvc
        .perform(post(base + "/" + sessionId + "/close").with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("CLOSED"));
  }

  @Test
  void operatorSoftDeleteClosedSessionRemovesFromList() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    String base =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/stock-count-sessions";

    MvcResult startResult =
        mockMvc
            .perform(post(base).with(operatorJwt()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("OPEN"))
            .andReturn();
    UUID sessionId =
        UUID.fromString(
            objectMapper
                .readTree(startResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    mockMvc
        .perform(post(base + "/" + sessionId + "/close").with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("CLOSED"));

    mockMvc
        .perform(get(base).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1));

    mockMvc
        .perform(delete(base + "/" + sessionId).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(sessionId.toString()));

    mockMvc
        .perform(get(base).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(0));
  }

  @Test
  void operatorSoftDeleteOpenSessionRemovesFromList() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    String base =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/stock-count-sessions";

    MvcResult startResult =
        mockMvc
            .perform(post(base).with(operatorJwt()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("OPEN"))
            .andReturn();
    UUID sessionId =
        UUID.fromString(
            objectMapper
                .readTree(startResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    mockMvc
        .perform(get(base).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1));

    mockMvc
        .perform(delete(base + "/" + sessionId).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(sessionId.toString()));

    mockMvc
        .perform(get(base).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(0));
  }

  @Test
  void operatorGetSessionFromOtherBranchReturns404() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId, "Branch A");
    UUID otherBranchId = createBranch(orgId, businessId, "Branch B");
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    assignStaffToBranch(orgId, staffUserId, otherBranchId);

    String base =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/stock-count-sessions";
    MvcResult startResult =
        mockMvc.perform(post(base).with(operatorJwt())).andExpect(status().isCreated()).andReturn();
    UUID sessionId =
        UUID.fromString(
            objectMapper
                .readTree(startResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    String otherBase =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + otherBranchId + "/stock-count-sessions";
    mockMvc
        .perform(get(otherBase + "/" + sessionId).with(operatorJwt()))
        .andExpect(status().isNotFound());
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Test Org StockCount Op " + UUID.randomUUID()));
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
    return createBranch(orgId, businessId, "Branch");
  }

  private UUID createBranch(UUID orgId, UUID businessId, String name) throws Exception {
    String body =
        """
        {"businessId":"%s","name":"%s","timezone":"Africa/Nairobi","currency":"KES"}
        """
            .formatted(businessId, name);
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
                    .content("{\"iamUserId\":\"operator\",\"username\":\"operator\"}"))
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
}
