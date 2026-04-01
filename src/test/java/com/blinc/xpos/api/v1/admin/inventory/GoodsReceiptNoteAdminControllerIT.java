package com.blinc.xpos.api.v1.admin.inventory;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.blinc.xpos.AbstractIntegrationTest;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgCreateRequest;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class GoodsReceiptNoteAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void createGrnWithLinesThenListAndGet() throws Exception {
    UUID orgId = createOrg("GRN Happy Path Org");
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId, "Acme Supplies");
    UUID itemId = createItem(orgId);
    String createBody =
        "{\"branchId\":\"" + branchId + "\",\"supplierId\":\"" + supplierId
            + "\",\"lines\":[{\"itemId\":\"" + itemId + "\",\"qty\":5,\"receivedUnitCost\":10.00}]}";
    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.supplierName").value("Acme Supplies"))
            .andExpect(jsonPath("$.lines.length()").value(1))
            .andReturn();
    UUID grnId =
        UUID.fromString(
            objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asText());
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes?branchId=" + branchId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.content[0].supplierName").value("Acme Supplies"));
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes/" + grnId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(grnId.toString()))
        .andExpect(jsonPath("$.supplierName").value("Acme Supplies"));
  }

  @Test
  void getGrnNotFoundReturns404() throws Exception {
    UUID orgId = createOrg("GRN Get 404 Org");
    UUID grnId = UUID.randomUUID();
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes/" + grnId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isNotFound());
  }

  @Test
  void listByBranchOtherOrgBranchReturnsNotFound() throws Exception {
    UUID orgId = createOrg("GRN List Org A");
    UUID otherOrgId = createOrg("GRN List Org B");
    UUID businessId = createBusiness(otherOrgId);
    UUID otherBranchId = createBranch(otherOrgId, businessId);
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes?branchId=" + otherBranchId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isNotFound());
  }

  @Test
  void updateGrnThenSoftDelete() throws Exception {
    UUID orgId = createOrg("GRN Update Delete Org");
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId1 = createSupplier(orgId, "Supplier A");
    UUID supplierId2 = createSupplier(orgId, "Supplier B");
    UUID itemId = createItem(orgId);
    String createBody =
        "{\"branchId\":\"" + branchId + "\",\"supplierId\":\"" + supplierId1
            + "\",\"lines\":[{\"itemId\":\"" + itemId + "\",\"qty\":3,\"receivedUnitCost\":5}]}";
    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andReturn();
    UUID grnId =
        UUID.fromString(
            objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asText());
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/inventory-report?branchId=" + branchId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].onHandQty").value(3));
    String receivedAt = "2026-01-15T10:00:00Z";
    String updateBody =
        "{\"supplierId\":\"" + supplierId2 + "\",\"receivedAt\":\"" + receivedAt + "\"}";
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes/" + grnId)
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(updateBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.supplierName").value("Supplier B"));
    String softDeleteBody =
        "{\"supplierId\":\"" + supplierId2 + "\",\"receivedAt\":\"" + receivedAt + "\",\"active\":false}";
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes/" + grnId)
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(softDeleteBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.active").value(false));
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/inventory-report?branchId=" + branchId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].onHandQty").value(0));
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes?branchId=" + branchId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(0));
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes?branchId=" + branchId
                + "&includeInactive=true")
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.content[0].active").value(false));
  }

  @Test
  void updateGrnLineQtyIncreaseAfterPartialConsumptionSucceedsUsingNetDelta() throws Exception {
    UUID orgId = createOrg("GRN Net Delta Increase Org");
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId, "Supplier Net+");
    UUID itemId = createItem(orgId);
    String createBody =
        "{\"branchId\":\"" + branchId + "\",\"supplierId\":\"" + supplierId
            + "\",\"lines\":[{\"itemId\":\"" + itemId + "\",\"qty\":5,\"receivedUnitCost\":100}]}";
    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andReturn();
    UUID grnId =
        UUID.fromString(
            objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asText());
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/inventory-report?branchId=" + branchId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].onHandQty").value(5));
    jdbcTemplate.update(
        "UPDATE inventory_item SET on_hand_qty = ? WHERE org_id = ? AND branch_id = ? AND item_id = ?",
        new BigDecimal("3.000"),
        orgId,
        branchId,
        itemId);
    String receivedAt = "2026-03-20T12:00:00Z";
    String updateBody =
        "{\"supplierId\":\"" + supplierId + "\",\"receivedAt\":\"" + receivedAt + "\",\"lines\":"
            + "[{\"itemId\":\"" + itemId + "\",\"qty\":10,\"receivedUnitCost\":100}]}";
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes/" + grnId)
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(updateBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lines[0].qty").value(10));
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/inventory-report?branchId=" + branchId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].onHandQty").value(8));
  }

  @Test
  void updateGrnLineQtyDecreaseBeyondOnHandReturns409() throws Exception {
    UUID orgId = createOrg("GRN Net Delta Decrease Conflict Org");
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId, "Supplier Net-");
    UUID itemId = createItem(orgId);
    String createBody =
        "{\"branchId\":\"" + branchId + "\",\"supplierId\":\"" + supplierId
            + "\",\"lines\":[{\"itemId\":\"" + itemId + "\",\"qty\":5,\"receivedUnitCost\":50}]}";
    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andReturn();
    UUID grnId =
        UUID.fromString(
            objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asText());
    jdbcTemplate.update(
        "UPDATE inventory_item SET on_hand_qty = ? WHERE org_id = ? AND branch_id = ? AND item_id = ?",
        new BigDecimal("2.000"),
        orgId,
        branchId,
        itemId);
    String receivedAt = "2026-03-21T12:00:00Z";
    String updateBody =
        "{\"supplierId\":\"" + supplierId + "\",\"receivedAt\":\"" + receivedAt + "\",\"lines\":"
            + "[{\"itemId\":\"" + itemId + "\",\"qty\":1,\"receivedUnitCost\":50}]}";
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes/" + grnId)
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(updateBody))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("INSUFFICIENT_STOCK"));
  }

  @Test
  void secondCreateSameDaySameSupplierMergesIntoOneGrnKeepsUnitCost() throws Exception {
    UUID orgId = createOrg("GRN Same-Day Merge Org");
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId, "Isanda");
    UUID itemId = createItem(orgId);
    String createBody1 =
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierId
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":5,\"receivedUnitCost\":100}]}";
    MvcResult createResult1 =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(createBody1))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.lines.length()").value(1))
            .andExpect(jsonPath("$.lines[0].qty").value(5))
            .andReturn();
    UUID grnId =
        UUID.fromString(
            objectMapper.readTree(createResult1.getResponse().getContentAsString()).get("id").asText());
    String createBody2 =
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierId
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":10,\"receivedUnitCost\":100}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(createBody2))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value(grnId.toString()))
        .andExpect(jsonPath("$.lines.length()").value(1))
        .andExpect(jsonPath("$.lines[0].qty").value(15))
        .andExpect(jsonPath("$.lines[0].receivedUnitCost").value(100));
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes?branchId=" + branchId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1));
  }

  @Test
  void sameDayMergeWithDifferentUnitCostReturns409() throws Exception {
    UUID orgId = createOrg("GRN Merge Cost Mismatch Org");
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId, "Isanda");
    UUID itemId = createItem(orgId);
    String createBody1 =
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierId
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":5,\"receivedUnitCost\":100}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(createBody1))
        .andExpect(status().isCreated());
    String createBody2 =
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierId
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":1,\"receivedUnitCost\":200}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(createBody2))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("GRN_ITEM_UNIT_COST_MERGE_MISMATCH"));
  }

  @Test
  void sameDayDifferentSuppliersDoNotMerge() throws Exception {
    UUID orgId = createOrg("GRN Same-Day Two Suppliers Org");
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierA = createSupplier(orgId, "Supplier A");
    UUID supplierB = createSupplier(orgId, "Supplier B");
    UUID itemId = createItem(orgId);
    String bodyA =
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierA
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":1,\"receivedUnitCost\":10}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(bodyA))
        .andExpect(status().isCreated());
    String bodyB =
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierB
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":2,\"receivedUnitCost\":10}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(bodyB))
        .andExpect(status().isCreated());
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes?branchId=" + branchId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(2));
  }

  @Test
  void secondGrnDifferentUnitCostForSameItemReturns409() throws Exception {
    UUID orgId = createOrg("GRN Unit Cost Lock Org");
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierA = createSupplier(orgId, "Supplier A");
    UUID supplierB = createSupplier(orgId, "Supplier B");
    UUID itemId = createItem(orgId);
    String first =
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierA
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":1,\"receivedUnitCost\":100}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(first))
        .andExpect(status().isCreated());
    String second =
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierB
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":1,\"receivedUnitCost\":200}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(second))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("GRN_ITEM_UNIT_COST_MISMATCH"));
  }

  @Test
  void permanentDeleteRemovesGrnAndReversesInventory() throws Exception {
    UUID orgId = createOrg("GRN Permanent Delete Org");
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId, "Supp PD");
    UUID itemId = createItem(orgId);
    String createBody =
        "{\"branchId\":\"" + branchId + "\",\"supplierId\":\"" + supplierId
            + "\",\"lines\":[{\"itemId\":\"" + itemId + "\",\"qty\":7,\"receivedUnitCost\":3}]}";
    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andReturn();
    UUID grnId =
        UUID.fromString(
            objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asText());
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/inventory-report?branchId=" + branchId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].onHandQty").value(7))
        .andExpect(jsonPath("$.content[0].receivedQty").value(7));
    mockMvc
        .perform(
            delete("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes/" + grnId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isNoContent());
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes/" + grnId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isNotFound());
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/inventory-report?branchId=" + branchId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].onHandQty").value(0))
        .andExpect(jsonPath("$.content[0].receivedQty").value(0));
  }

  @Test
  void permanentDeleteInactiveItemWithZeroOnHandSucceeds() throws Exception {
    UUID orgId = createOrg("GRN Perm Delete Inactive Zero Org");
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId, "Supp Inactive Zero");
    UUID itemId = createItem(orgId);
    String createBody =
        "{\"branchId\":\"" + branchId + "\",\"supplierId\":\"" + supplierId
            + "\",\"lines\":[{\"itemId\":\"" + itemId + "\",\"qty\":4,\"receivedUnitCost\":2}]}";
    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andReturn();
    UUID grnId =
        UUID.fromString(
            objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asText());
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/inventory-report?branchId=" + branchId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].onHandQty").value(4));
    deactivateItem(orgId, itemId);
    jdbcTemplate.update(
        "UPDATE inventory_item SET on_hand_qty = 0 WHERE org_id = ? AND branch_id = ? AND item_id = ?",
        orgId,
        branchId,
        itemId);
    mockMvc
        .perform(
            delete("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes/" + grnId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isNoContent());
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes/" + grnId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isNotFound());
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/inventory-report?branchId=" + branchId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].onHandQty").value(0))
        .andExpect(jsonPath("$.content[0].receivedQty").value(0));
  }

  @Test
  void createGrnWithInactiveItemReturns400() throws Exception {
    UUID orgId = createOrg("GRN Inactive Item Org");
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId, "Supp Inactive GRN");
    UUID itemId = createItem(orgId);
    deactivateItem(orgId, itemId);
    String createBody =
        "{\"branchId\":\"" + branchId + "\",\"supplierId\":\"" + supplierId
            + "\",\"lines\":[{\"itemId\":\"" + itemId + "\",\"qty\":1,\"receivedUnitCost\":10}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(createBody))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("ITEM_INACTIVE"));
  }

  @Test
  void permanentDeleteGrnNotFoundReturns404() throws Exception {
    UUID orgId = createOrg("GRN Permanent Delete 404 Org");
    UUID grnId = UUID.randomUUID();
    mockMvc
        .perform(
            delete("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes/" + grnId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isNotFound());
  }

  @Test
  void createGrnMissingBranchIdReturns400() throws Exception {
    UUID orgId = createOrg("GRN Create 400 Org");
    UUID supplierId = createSupplier(orgId, "S");
    UUID itemId = createItem(orgId);
    String body =
        "{\"supplierId\":\"" + supplierId
            + "\",\"lines\":[{\"itemId\":\"" + itemId + "\",\"qty\":1,\"receivedUnitCost\":1}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isBadRequest());
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

  private UUID createSupplier(UUID orgId) throws Exception {
    return createSupplier(orgId, "Supplier");
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

  private void deactivateItem(UUID orgId, UUID itemId) throws Exception {
    MvcResult getItem =
        mockMvc
            .perform(
                get("/api/v1/admin/orgs/" + orgId + "/items/" + itemId)
                    .with(jwt().jwt(j -> j.subject("admin"))))
            .andExpect(status().isOk())
            .andReturn();
    ObjectNode itemNode =
        (ObjectNode) objectMapper.readTree(getItem.getResponse().getContentAsString());
    itemNode.remove("id");
    itemNode.remove("orgId");
    itemNode.remove("primaryImageUrl");
    itemNode.remove("hasPurchaseHistory");
    itemNode.remove("createdAt");
    itemNode.remove("updatedAt");
    itemNode.remove("barcode");
    itemNode.put("active", false);
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/items/" + itemId)
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(itemNode)))
        .andExpect(status().isOk());
  }
}
