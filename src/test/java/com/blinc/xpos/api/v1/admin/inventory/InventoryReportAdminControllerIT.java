package com.blinc.xpos.api.v1.admin.inventory;

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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class InventoryReportAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void listInventoryReportAfterGrnShowsOnHandAndSold() throws Exception {
    UUID orgId = createOrg("Inventory Report Org");
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId, "Supp");
    UUID itemId = createItem(orgId);
    String grnBody =
        "{\"branchId\":\"" + branchId + "\",\"supplierId\":\"" + supplierId
            + "\",\"lines\":[{\"itemId\":\"" + itemId + "\",\"qty\":10,\"receivedUnitCost\":5}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(grnBody))
        .andExpect(status().isCreated());

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/inventory-report?branchId=" + branchId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.content[0].itemId").value(itemId.toString()))
        .andExpect(jsonPath("$.content[0].itemName").value("Item"))
        .andExpect(jsonPath("$.content[0].onHandQty").value(10))
        .andExpect(jsonPath("$.content[0].soldQty").value(0))
        .andExpect(jsonPath("$.content[0].reservedQty").value(0))
        .andExpect(jsonPath("$.content[0].receivedQty").value(10))
        .andExpect(jsonPath("$.content[0].trackInventory").value(true));
  }

  @Test
  void listInventoryReportOtherOrgBranchReturns404() throws Exception {
    UUID orgId = createOrg("Inventory Org A");
    UUID otherOrgId = createOrg("Inventory Org B");
    UUID businessId = createBusiness(otherOrgId);
    UUID otherBranchId = createBranch(otherOrgId, businessId);
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/inventory-report?branchId=" + otherBranchId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isNotFound());
  }

  @Test
  void listInventoryReportMissingBranchIdReturns400() throws Exception {
    UUID orgId = createOrg("Inventory Missing Branch Org");
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/inventory-report")
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void listInventoryReportEmptyBranchReturnsEmptyPage() throws Exception {
    UUID orgId = createOrg("Inventory Empty Org");
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/inventory-report?branchId=" + branchId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(0))
        .andExpect(jsonPath("$.totalElements").value(0));
  }

  private UUID createOrg(String name) throws Exception {
    String body = objectMapper.writeValueAsString(new OrgCreateRequest(name));
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
    String body = "{\"businessId\":\"" + businessId + "\",\"name\":\"Main\","
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

  private UUID createSupplier(UUID orgId, String name) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/suppliers")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content("{\"name\":\"" + name + "\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createItem(UUID orgId) throws Exception {
    UUID taxProfileId = createTaxProfile(orgId);
    String body = "{\"name\":\"Item\",\"itemType\":\"STOCK\",\"taxProfileId\":\"" + taxProfileId
        + "\",\"trackInventory\":true,\"active\":true}";
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/items")
                    .with(jwt().jwt(j -> j.subject("admin")))
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
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(
                        "{\"name\":\"VAT\",\"vatCategory\":\"STANDARD\","
                            + "\"serviceChargeRate\":0,\"levyRate\":0}"))
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
                    .with(jwt().jwt(j -> j.subject("admin")))
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
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content("{\"branchId\":\"" + branchId + "\",\"primary\":true}"))
        .andExpect(status().isCreated());
  }
}
