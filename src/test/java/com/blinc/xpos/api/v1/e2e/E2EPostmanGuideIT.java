package com.blinc.xpos.api.v1.e2e;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
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

/**
 * Integration test that runs every endpoint from docs/E2E_POSTMAN_GUIDE.md in order (steps 1-16)
 * with exact paths and request bodies from the guide. Ensures all guide endpoints are working.
 */
@SpringBootTest
@AutoConfigureMockMvc
class E2EPostmanGuideIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void allE2EPostmanGuideEndpointsInOrder() throws Exception {
    step1Health();
    UUID orgId = step2CreateOrg();
    UUID businessId = step3CreateBusiness(orgId);
    UUID branchId = step4CreateBranch(orgId, businessId);
    UUID terminalId = step5CreateTerminal(orgId, branchId);
    UUID deviceRegistrationId = step6aRegisterDevice(orgId, branchId);
    step6bBindDevice(orgId, branchId, terminalId, deviceRegistrationId);
    UUID staffUserId = step7aCreateStaffUser(orgId);
    step7bSetStaffProfile(orgId, staffUserId, branchId);
    step7cAssignStaffToBranch(orgId, staffUserId, branchId);
    UUID categoryId = step8aCreateCategory(orgId);
    UUID uomId = step8bCreateUom(orgId);
    UUID taxProfileId = step8cCreateTaxProfile(orgId);
    UUID itemId = step8dCreateItem(orgId, categoryId, uomId, taxProfileId);
    UUID priceListId = step9aCreatePriceList(orgId, branchId);
    UUID supplierId = step9a1CreateSupplier(orgId);
    step9a2CreateGrnForItem(orgId, branchId, supplierId, itemId);
    step9bAddPriceListItem(orgId, priceListId, itemId);
    UUID tenderTypeId = step10CreateTenderType(orgId);
    step10aLedgerAndPostingRule(orgId);
    String operatorBase = step11OpenShift(orgId, branchId, terminalId);
    UUID saleId = step12CreateSale(operatorBase, priceListId);
    step13AddLine(operatorBase, saleId, itemId);
    step14AddTender(operatorBase, saleId, tenderTypeId);
    step15CompleteSale(operatorBase, saleId);
    step16GetReceipt(operatorBase, saleId);
    step16bGetReceiptDetails(operatorBase, saleId);
  }

  private void step1Health() throws Exception {
    mockMvc.perform(get("/api/v1/health/ping")).andExpect(status().isOk());
  }

  private UUID step2CreateOrg() throws Exception {
    MvcResult r =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            new OrgCreateRequest("My Bar & Restaurant"))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andReturn();
    return objectMapper.readValue(r.getResponse().getContentAsString(), OrgResponse.class).id();
  }

  private UUID step3CreateBusiness(UUID orgId) throws Exception {
    String body =
        """
        {"legalName":"My Bar Ltd","kraPin":"P051234567X","logoUrl":null,"receiptFooter":"Thank you!"}
        """;
    MvcResult r =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/businesses")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID step4CreateBranch(UUID orgId, UUID businessId) throws Exception {
    String body =
        """
        {"businessId":"%s","name":"Main Branch","timezone":"Africa/Nairobi","currency":"KES",
        "addressJson":null,"taxAgencyConfigId":null,"receiptTemplateId":null}
        """
            .formatted(businessId);
    MvcResult r =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/branches")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID step5CreateTerminal(UUID orgId, UUID branchId) throws Exception {
    String body = """
        {"terminalCode":"T1","printerProfileId":null}
        """;
    MvcResult r =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/branches/" + branchId + "/terminals")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID step6aRegisterDevice(UUID orgId, UUID branchId) throws Exception {
    String body = """
        {"deviceId":"pos-device-001","deviceFingerprint":"optional"}
        """;
    MvcResult r =
        mockMvc
            .perform(
                post(
                        "/api/v1/admin/orgs/"
                            + orgId
                            + "/branches/"
                            + branchId
                            + "/devices/register")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
  }

  private void step6bBindDevice(
      UUID orgId, UUID branchId, UUID terminalId, UUID deviceRegistrationId) throws Exception {
    String body = """
        {"deviceRegistrationId":"%s"}
        """
            .formatted(deviceRegistrationId);
    mockMvc
        .perform(
            post(
                    "/api/v1/admin/orgs/"
                        + orgId
                        + "/branches/"
                        + branchId
                        + "/terminals/"
                        + terminalId
                        + "/bind-device")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk());
  }

  private UUID step7aCreateStaffUser(UUID orgId) throws Exception {
    String body = """
        {"iamUserId":"admin","username":"cashier1"}
        """;
    MvcResult r =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/staff-users")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
  }

  private void step7bSetStaffProfile(UUID orgId, UUID staffUserId, UUID branchId) throws Exception {
    String body =
        """
        {"displayName":"Cashier One","phone":null,"email":null,"employeeNo":"EMP001",
        "defaultBranchId":"%s","status":"ACTIVE"}
        """
            .formatted(branchId);
    mockMvc
        .perform(
            put("/api/v1/admin/orgs/" + orgId + "/staff-users/" + staffUserId + "/profile")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk());
  }

  private void step7cAssignStaffToBranch(UUID orgId, UUID staffUserId, UUID branchId)
      throws Exception {
    String body = """
        {"branchId":"%s","primary":true}
        """
            .formatted(branchId);
    mockMvc
        .perform(
            post(
                    "/api/v1/admin/orgs/"
                        + orgId
                        + "/staff-users/"
                        + staffUserId
                        + "/branches")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }

  private UUID step8aCreateCategory(UUID orgId) throws Exception {
    String body = """
        {"parentId":null,"name":"Beverages","type":"PRODUCT"}
        """;
    MvcResult r =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/categories")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID step8bCreateUom(UUID orgId) throws Exception {
    String body = """
        {"name":"Bottle","symbol":"btl"}
        """;
    MvcResult r =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/uoms")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID step8cCreateTaxProfile(UUID orgId) throws Exception {
    String body =
        """
        {"name":"VAT Standard","vatCategory":"STANDARD","serviceChargeRate":0,"levyRate":0}
        """;
    MvcResult r =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/tax-profiles")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID step8dCreateItem(
      UUID orgId, UUID categoryId, UUID uomId, UUID taxProfileId) throws Exception {
    String body =
        """
        {"sku":"BEER-001","name":"Tusker Bottle 500ml","itemType":"STOCK","categoryId":"%s",
        "baseUomId":"%s","taxProfileId":"%s","trackInventory":false,"active":true}
        """
            .formatted(categoryId, uomId, taxProfileId);
    MvcResult r =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/items")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID step9aCreatePriceList(UUID orgId, UUID branchId) throws Exception {
    String body =
        """
        {"branchId":"%s","channel":null,"name":"Default","priority":0,"active":true}
        """
            .formatted(branchId);
    MvcResult r =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-lists")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID step9a1CreateSupplier(UUID orgId) throws Exception {
    MvcResult r =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/suppliers")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content("{\"name\":\"Supplier\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
  }

  private void step9a2CreateGrnForItem(
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

  private void step9bAddPriceListItem(UUID orgId, UUID priceListId, UUID itemId) throws Exception {
    String body = """
        {"itemId":"%s","price":150,"currency":"KES"}
        """
            .formatted(itemId);
    mockMvc
        .perform(
            post(
                    "/api/v1/admin/orgs/"
                        + orgId
                        + "/price-lists/"
                        + priceListId
                        + "/items")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }

  /**
   * Orgs get CASH tender type auto-created on creation. Fetch it instead of creating.
   */
  private UUID step10CreateTenderType(UUID orgId) throws Exception {
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

  private void step10aLedgerAndPostingRule(UUID orgId) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/ledger-accounts")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content("{\"code\":\"1000\",\"name\":\"Cash\",\"accountType\":\"ASSET\"}"))
        .andExpect(status().isCreated());
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/ledger-accounts")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content("{\"code\":\"4000\",\"name\":\"Sales\",\"accountType\":\"INCOME\"}"))
        .andExpect(status().isCreated());
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/posting-rules")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(
                    "{\"eventType\":\"SALE_COMPLETE\",\"debitAccountCode\":\"1000\","
                        + "\"creditAccountCode\":\"4000\"}"))
        .andExpect(status().isCreated());
  }

  private String step11OpenShift(UUID orgId, UUID branchId, UUID terminalId) throws Exception {
    mockMvc
        .perform(
            post(
                    "/api/v1/operator/orgs/"
                        + orgId
                        + "/branches/"
                        + branchId
                        + "/terminals/"
                        + terminalId
                        + "/shifts")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content("{\"openingFloatAmount\":500}"))
        .andExpect(status().isCreated());
    return "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/terminals/" + terminalId;
  }

  private UUID step12CreateSale(String operatorBase, UUID priceListId) throws Exception {
    String body = """
        {"customerId":null,"priceListId":"%s"}
        """
            .formatted(priceListId);
    MvcResult r =
        mockMvc
            .perform(
                post(operatorBase + "/sales")
                    .with(jwt().jwt(j -> j.subject("admin")))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.status").value("OPEN"))
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
  }

  private void step13AddLine(String operatorBase, UUID saleId, UUID itemId) throws Exception {
    String body =
        """
        {"itemId":"%s","qty":1,"uomId":null,"unitPriceOverride":null,"modifiers":[]}
        """
            .formatted(itemId);
    mockMvc
        .perform(
            post(operatorBase + "/sales/" + saleId + "/lines")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(saleId.toString()))
        .andExpect(jsonPath("$.lines.length()").value(1))
        .andExpect(jsonPath("$.lines[0].itemId").value(itemId.toString()))
        .andExpect(jsonPath("$.lines[0].qty").value(1))
        .andExpect(jsonPath("$.total").value(150));
  }

  private void step14AddTender(String operatorBase, UUID saleId, UUID tenderTypeId)
      throws Exception {
    String body =
        """
        {"tenderTypeId":"%s","amount":200,"currency":"KES"}
        """
            .formatted(tenderTypeId);
    mockMvc
        .perform(
            post(operatorBase + "/sales/" + saleId + "/tenders")
                .with(jwt().jwt(j -> j.subject("admin")))
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").exists())
        .andExpect(jsonPath("$.amount").value(200));
  }

  private void step15CompleteSale(String operatorBase, UUID saleId) throws Exception {
    mockMvc
        .perform(
            post(operatorBase + "/sales/" + saleId + "/complete")
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("COMPLETED"))
        .andExpect(jsonPath("$.receiptId").exists());
  }

  private void step16GetReceipt(String operatorBase, UUID saleId) throws Exception {
    mockMvc
        .perform(
            get(operatorBase + "/sales/" + saleId + "/receipt")
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.receiptNumber").isNumber())
        .andExpect(jsonPath("$.businessDate").exists());
  }

  private void step16bGetReceiptDetails(String operatorBase, UUID saleId) throws Exception {
    mockMvc
        .perform(
            get(operatorBase + "/sales/" + saleId + "/receipt/details")
                .with(jwt().jwt(j -> j.subject("admin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.receiptNumber").isNumber())
        .andExpect(jsonPath("$.subtotal").exists())
        .andExpect(jsonPath("$.total").exists())
        .andExpect(jsonPath("$.amountTendered").exists())
        .andExpect(jsonPath("$.changeDue").exists())
        .andExpect(jsonPath("$.lines").isArray())
        .andExpect(jsonPath("$.tenders").isArray());
  }
}
