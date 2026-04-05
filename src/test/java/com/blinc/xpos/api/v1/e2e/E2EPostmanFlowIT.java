package com.blinc.xpos.api.v1.e2e;

import static com.blinc.xpos.TestJwtFactory.allRolesJwt;
import static org.springframework.http.MediaType.APPLICATION_JSON;
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
 * Full E2E test: runs the exact Postman flow from health through sale complete and receipt, then
 * verifies DB persistence via ledger-entries. Ensures all endpoints work end-to-end up to DB level.
 */
@SpringBootTest
@AutoConfigureMockMvc
class E2EPostmanFlowIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void fullPostmanFlowThenVerifyLedgerInDb() throws Exception {
    mockMvc.perform(get("/api/v1/health/ping")).andExpect(status().isOk());

    E2EContext ctx = runPostmanSetupThroughOpenShift();

    String base =
        "/api/v1/operator/orgs/"
            + ctx.orgId
            + "/branches/"
            + ctx.branchId
            + "/terminals/"
            + ctx.terminalId;

    UUID saleId =
        createSaleAndCompleteWithOneLine(base, ctx.priceListId, ctx.itemId, ctx.tenderTypeId);

    mockMvc
        .perform(get(base + "/sales/" + saleId + "/receipt").with(allRolesJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.receiptNumber").isNumber())
        .andExpect(jsonPath("$.businessDate").exists());

    assertLedgerEntriesForSale(ctx.orgId, ctx.branchId);
  }

  @Test
  void fullFlowThenSmokeAllGetEndpoints() throws Exception {
    mockMvc.perform(get("/api/v1/health/ping")).andExpect(status().isOk());
    E2EContext ctx = runPostmanSetupThroughOpenShift();
    String operatorBase =
        "/api/v1/operator/orgs/"
            + ctx.orgId
            + "/branches/"
            + ctx.branchId
            + "/terminals/"
            + ctx.terminalId;
    UUID saleId =
        createSaleAndCompleteWithOneLine(
            operatorBase, ctx.priceListId, ctx.itemId, ctx.tenderTypeId);
    smokeAllGetEndpoints(ctx, operatorBase, saleId);
  }

  private void smokeAllGetEndpoints(E2EContext ctx, String operatorBase, UUID saleId)
      throws Exception {
    smokeAdminGetEndpointsPart1(ctx);
    smokeAdminGetEndpointsPart2(ctx);
    smokeOperatorGetEndpoints(operatorBase, saleId, ctx.orgId);
  }

  private void smokeAdminGetEndpointsPart1(E2EContext ctx) throws Exception {
    String q = "?page=0&size=10";
    mockMvc.perform(get("/api/v1/admin/orgs" + q).with(allRolesJwt())).andExpect(status().isOk());
    mockMvc
        .perform(get("/api/v1/admin/orgs/" + ctx.orgId).with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(get("/api/v1/admin/orgs/" + ctx.orgId + "/context").with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(get("/api/v1/admin/orgs/" + ctx.orgId + "/businesses" + q).with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(get("/api/v1/admin/orgs/" + ctx.orgId + "/branches" + q).with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + ctx.orgId + "/branches/" + ctx.branchId + "/terminals" + q)
                .with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(get("/api/v1/admin/orgs/" + ctx.orgId + "/staff-users" + q).with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(get("/api/v1/admin/orgs/" + ctx.orgId + "/categories" + q).with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(get("/api/v1/admin/orgs/" + ctx.orgId + "/uoms" + q).with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(get("/api/v1/admin/orgs/" + ctx.orgId + "/tax-profiles" + q).with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(get("/api/v1/admin/orgs/" + ctx.orgId + "/items" + q).with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(get("/api/v1/admin/orgs/" + ctx.orgId + "/price-lists" + q).with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(get("/api/v1/admin/orgs/" + ctx.orgId + "/tender-types" + q).with(allRolesJwt()))
        .andExpect(status().isOk());
  }

  private void smokeAdminGetEndpointsPart2(E2EContext ctx) throws Exception {
    String q = "?page=0&size=10";
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + ctx.orgId + "/ledger-accounts" + q).with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(get("/api/v1/admin/orgs/" + ctx.orgId + "/posting-rules" + q).with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/"
                    + ctx.orgId
                    + "/ledger-entries?branchId="
                    + ctx.branchId
                    + "&page=0&size=10")
                .with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + ctx.orgId + "/branches/" + ctx.branchId + "/shifts" + q)
                .with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + ctx.orgId + "/branches/" + ctx.branchId + "/day-closes" + q)
                .with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/"
                    + ctx.orgId
                    + "/branches/"
                    + ctx.branchId
                    + "/cash-movements"
                    + q)
                .with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(get("/api/v1/admin/orgs/" + ctx.orgId + "/audit-logs" + q).with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + ctx.orgId + "/audit-vault-records" + q).with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(get("/api/v1/admin/orgs/" + ctx.orgId + "/outbox-events" + q).with(allRolesJwt()))
        .andExpect(status().isOk());
  }

  private void smokeOperatorGetEndpoints(String operatorBase, UUID saleId, UUID orgId)
      throws Exception {
    mockMvc.perform(get(operatorBase + "/sales").with(allRolesJwt())).andExpect(status().isOk());
    mockMvc
        .perform(get(operatorBase + "/sales/" + saleId).with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(get(operatorBase + "/sales/" + saleId + "/receipt").with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(get(operatorBase + "/sales/" + saleId + "/receipt/details").with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(get(operatorBase + "/shifts/current").with(allRolesJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(get("/api/v1/me?orgId=" + orgId).with(allRolesJwt()))
        .andExpect(status().isOk());
  }

  private E2EContext runPostmanSetupThroughOpenShift() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID terminalId = createTerminal(orgId, branchId);
    UUID deviceRegistrationId = registerDevice(orgId, branchId);
    bindDeviceToTerminal(orgId, branchId, terminalId, deviceRegistrationId);
    UUID staffUserId = createStaffUser(orgId);
    upsertStaffProfile(orgId, staffUserId, branchId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID categoryId = createCategory(orgId);
    UUID uomId = createUom(orgId);
    UUID taxProfileId = createTaxProfile(orgId);
    UUID itemId = createItem(orgId, categoryId, uomId, taxProfileId);
    UUID supplierId = createSupplier(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);
    UUID priceListId = createPriceList(orgId, branchId);
    addItemToPriceList(orgId, priceListId, itemId);
    UUID tenderTypeId = getCashTenderTypeId(orgId);
    createLedgerAccount(orgId, "1000", "Cash", "ASSET");
    createLedgerAccount(orgId, "4000", "Sales", "INCOME");
    createPostingRule(orgId, "SALE_COMPLETE", "1000", "4000");
    openShift(orgId, branchId, terminalId);
    return new E2EContext(orgId, branchId, terminalId, priceListId, itemId, tenderTypeId);
  }

  private UUID createSaleAndCompleteWithOneLine(
      String base, UUID priceListId, UUID itemId, UUID tenderTypeId) throws Exception {
    MvcResult createSaleResult =
        mockMvc
            .perform(
                post(base + "/sales")
                    .with(allRolesJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"priceListId\":\"" + priceListId + "\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.status").value("OPEN"))
            .andReturn();
    UUID saleId =
        UUID.fromString(
            objectMapper
                .readTree(createSaleResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    mockMvc
        .perform(
            post(base + "/sales/" + saleId + "/lines")
                .with(allRolesJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"itemId":"%s","qty":1,"uomId":null,"unitPriceOverride":null,"modifiers":[]}
                    """
                        .formatted(itemId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lines.length()").value(1));

    mockMvc
        .perform(
            post(base + "/sales/" + saleId + "/tenders")
                .with(allRolesJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"tenderTypeId":"%s","amount":200,"currency":"KES"}
                    """
                        .formatted(tenderTypeId)))
        .andExpect(status().isCreated());

    mockMvc
        .perform(post(base + "/sales/" + saleId + "/complete").with(allRolesJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("COMPLETED"))
        .andExpect(jsonPath("$.receiptId").exists());

    return saleId;
  }

  private void assertLedgerEntriesForSale(UUID orgId, UUID branchId) throws Exception {
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/"
                    + orgId
                    + "/ledger-entries?branchId="
                    + branchId
                    + "&page=0&size=20")
                .with(allRolesJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(2))
        .andExpect(jsonPath("$.content[0].sourceType").value("SALE"))
        .andExpect(jsonPath("$.content[1].sourceType").value("SALE"));
  }

  private record E2EContext(
      UUID orgId,
      UUID branchId,
      UUID terminalId,
      UUID priceListId,
      UUID itemId,
      UUID tenderTypeId) {}

  private void createLedgerAccount(UUID orgId, String code, String name, String accountType)
      throws Exception {
    String body =
        """
        {"code":"%s","name":"%s","accountType":"%s"}
        """
            .formatted(code, name, accountType);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/ledger-accounts")
                .with(allRolesJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }

  private void createPostingRule(
      UUID orgId, String eventType, String debitAccountCode, String creditAccountCode)
      throws Exception {
    String body =
        """
        {"eventType":"%s","debitAccountCode":"%s","creditAccountCode":"%s"}
        """
            .formatted(eventType, debitAccountCode, creditAccountCode);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/posting-rules")
                .with(allRolesJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(new OrgCreateRequest("E2E Org " + UUID.randomUUID()));
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs")
                    .with(allRolesJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    OrgResponse org =
        objectMapper.readValue(result.getResponse().getContentAsString(), OrgResponse.class);
    return org.id();
  }

  private UUID createBusiness(UUID orgId) throws Exception {
    String body = """
        {"legalName":"E2E Business"}
        """;
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/businesses")
                    .with(allRolesJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createBranch(UUID orgId, UUID businessId) throws Exception {
    String body =
        """
        {"businessId":"%s","name":"Main Branch","timezone":"Africa/Nairobi","currency":"KES"}
        """
            .formatted(businessId);
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/branches")
                    .with(allRolesJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createTerminal(UUID orgId, UUID branchId) throws Exception {
    String body = """
        {"terminalCode":"T1"}
        """;
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/branches/" + branchId + "/terminals")
                    .with(allRolesJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID registerDevice(UUID orgId, UUID branchId) throws Exception {
    String body =
        """
        {"deviceId":"e2e-device-001","deviceFingerprint":"optional"}
        """;
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/branches/" + branchId + "/devices/register")
                    .with(allRolesJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private void bindDeviceToTerminal(
      UUID orgId, UUID branchId, UUID terminalId, UUID deviceRegistrationId) throws Exception {
    String body =
        """
        {"deviceRegistrationId":"%s"}
        """.formatted(deviceRegistrationId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/terminals/"
                    + terminalId
                    + "/bind-device")
                .with(allRolesJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk());
  }

  private UUID createStaffUser(UUID orgId) throws Exception {
    String body = """
        {"iamUserId":"admin","username":"admin"}
        """;
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/staff-users")
                    .with(allRolesJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private void upsertStaffProfile(UUID orgId, UUID staffUserId, UUID branchId) throws Exception {
    String body =
        """
        {"displayName":"E2E Cashier","phone":null,"email":null,"employeeNo":"E2E001","defaultBranchId":"%s","status":"ACTIVE"}
        """
            .formatted(branchId);
    mockMvc
        .perform(
            put("/api/v1/admin/orgs/" + orgId + "/staff-users/" + staffUserId + "/profile")
                .with(allRolesJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk());
  }

  private void assignStaffToBranch(UUID orgId, UUID staffUserId, UUID branchId) throws Exception {
    String body = """
        {"branchId":"%s","primary":true}
        """.formatted(branchId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/staff-users/" + staffUserId + "/branches")
                .with(allRolesJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }

  private UUID createCategory(UUID orgId) throws Exception {
    String body = """
        {"parentId":null,"name":"Beverages","type":"PRODUCT"}
        """;
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/categories")
                    .with(allRolesJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createUom(UUID orgId) throws Exception {
    String body = """
        {"name":"Bottle","symbol":"btl"}
        """;
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/uoms")
                    .with(allRolesJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createTaxProfile(UUID orgId) throws Exception {
    String body =
        """
        {"name":"VAT Standard","vatCategory":"STANDARD","serviceChargeRate":0,"levyRate":0}
        """;
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/tax-profiles")
                    .with(allRolesJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createItem(UUID orgId, UUID categoryId, UUID baseUomId, UUID taxProfileId)
      throws Exception {
    String body =
        ("{\"sku\":\"BEER-001\",\"name\":\"Tusker Bottle 500ml\",\"itemType\":\"STOCK\","
                + "\"categoryId\":\"%s\",\"baseUomId\":\"%s\",\"taxProfileId\":\"%s\","
                + "\"trackInventory\":false,\"active\":true}")
            .formatted(categoryId, baseUomId, taxProfileId);
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/items")
                    .with(allRolesJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createPriceList(UUID orgId, UUID branchId) throws Exception {
    String body =
        """
        {"branchId":"%s","channel":null,"name":"Default","priority":0,"active":true}
        """
            .formatted(branchId);
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-lists")
                    .with(allRolesJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
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
                    .with(allRolesJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"name\":\"Test Supplier\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private void createGrnForItem(UUID orgId, UUID branchId, UUID supplierId, UUID itemId)
      throws Exception {
    String body =
        """
        {"branchId":"%s","supplierId":"%s","lines":[{"itemId":"%s","qty":5,"receivedUnitCost":80.00}]}
        """
            .formatted(branchId, supplierId, itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(allRolesJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }

  private void addItemToPriceList(UUID orgId, UUID priceListId, UUID itemId) throws Exception {
    String body =
        """
        {"itemId":"%s","price":150,"currency":"KES"}
        """.formatted(itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(allRolesJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }

  /** Orgs get CASH tender type auto-created on creation. Fetch it instead of creating. */
  private UUID getCashTenderTypeId(UUID orgId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(get("/api/v1/admin/orgs/" + orgId + "/tender-types").with(allRolesJwt()))
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

  private void openShift(UUID orgId, UUID branchId, UUID terminalId) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/operator/orgs/"
                    + orgId
                    + "/branches/"
                    + branchId
                    + "/terminals/"
                    + terminalId
                    + "/shifts")
                .with(allRolesJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"openingFloatAmount\":500}"))
        .andExpect(status().isCreated());
  }
}
