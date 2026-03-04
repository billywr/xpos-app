package com.blinc.xpos.api.v1.admin.compliance;

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
class EtimsInvoiceRecordAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void createThenGetAndListEtimsInvoiceRecords() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID terminalId = createTerminal(orgId, branchId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    openShift(orgId, branchId, terminalId);
    UUID priceListId = createPriceList(orgId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);
    addItemToPriceList(orgId, priceListId, itemId);
    UUID tenderTypeId = getCashTenderTypeId(orgId);
    UUID saleId = createCompletedSale(orgId, branchId, terminalId, itemId, tenderTypeId);

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/branches/" + branchId
                    + "/etims-invoice-records")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content("{\"saleId\":\"" + saleId + "\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.saleId").value(saleId.toString()))
            .andReturn();
    UUID recordId =
        UUID.fromString(
            objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asText());

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/branches/" + branchId + "/etims-invoice-records/"
                + recordId)
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.saleId").value(saleId.toString()));

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/branches/" + branchId
                + "/etims-invoice-records?page=0&size=10")
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1));
  }

  private UUID createCompletedSale(
      UUID orgId, UUID branchId, UUID terminalId, UUID itemId, UUID tenderTypeId)
      throws Exception {
    String base =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/terminals/" + terminalId;
    MvcResult createSaleResult =
        mockMvc
            .perform(
                post(base + "/sales")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content("{}"))
            .andExpect(status().isCreated())
            .andReturn();
    UUID saleId =
        UUID.fromString(
            objectMapper.readTree(createSaleResult.getResponse().getContentAsString()).get("id").asText());
    mockMvc
        .perform(
            post(base + "/sales/" + saleId + "/lines")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(
                    "{\"itemId\":\"" + itemId + "\",\"qty\":1,\"unitPriceOverride\":50.00}"))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            post(base + "/sales/" + saleId + "/tenders")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(
                    "{\"tenderTypeId\":\"" + tenderTypeId + "\",\"amount\":50,\"currency\":\"KES\"}"))
        .andExpect(status().isCreated());
    mockMvc
        .perform(post(base + "/sales/" + saleId + "/complete").with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk());
    return saleId;
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(new OrgCreateRequest("Test Org Etims"));
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
        """
        {"businessId":"%s","name":"B1","timezone":"Africa/Nairobi","currency":"KES"}
        """
            .formatted(businessId);
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

  private UUID createTerminal(UUID orgId, UUID branchId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/branches/" + branchId + "/terminals")
                    .with(jwt().jwt(j -> j.subject("admin")))
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

  private void openShift(UUID orgId, UUID branchId, UUID terminalId) throws Exception {
    String base =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/terminals/" + terminalId;
    mockMvc
        .perform(
            post(base + "/shifts")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content("{\"openingFloatAmount\":0}"))
        .andExpect(status().isCreated());
  }

  private UUID createPriceList(UUID orgId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-lists")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content("{\"name\":\"Default\",\"priority\":0,\"active\":true}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createItem(UUID orgId) throws Exception {
    UUID taxProfileId = createTaxProfile(orgId);
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/items")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(
                        "{\"name\":\"Item\",\"itemType\":\"STOCK\",\"taxProfileId\":\""
                            + taxProfileId
                            + "\",\"trackInventory\":false,\"active\":true}"))
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
                        "{\"name\":\"VAT\",\"vatCategory\":\"STANDARD\",\"serviceChargeRate\":0,"
                            + "\"levyRate\":0}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createSupplier(UUID orgId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/suppliers")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content("{\"name\":\"Supplier\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private void createGrnForItem(
      UUID orgId, UUID branchId, UUID supplierId, UUID itemId) throws Exception {
    String body =
        """
        {"branchId":"%s","supplierId":"%s","lines":[{"itemId":"%s","qty":5,"receivedUnitCost":40.00}]}
        """
            .formatted(branchId, supplierId, itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }

  private void addItemToPriceList(UUID orgId, UUID priceListId, UUID itemId) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content("{\"itemId\":\"" + itemId + "\",\"price\":50,\"currency\":\"KES\"}"))
        .andExpect(status().isCreated());
  }

  /**
   * Orgs get CASH tender type auto-created on creation. Fetch it instead of creating.
   */
  private UUID getCashTenderTypeId(UUID orgId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                get("/api/v1/admin/orgs/" + orgId + "/tender-types")
                    .with(jwt().jwt(j -> j.subject("admin"))))
            .andExpect(status().isOk())
            .andReturn();
    var tree = objectMapper.readTree(result.getResponse().getContentAsString());
    var list = tree.isArray() ? tree : tree.get("content");
    if (list == null) {
      throw new IllegalStateException("No tender types for org " + orgId);
    }
    for (var el : list) {
      if ("CASH".equals(el.get("code").asText())) {
        return UUID.fromString(el.get("id").asText());
      }
    }
    throw new IllegalStateException("CASH tender type not found for org " + orgId);
  }
}
