package com.blinc.xpos.api.v1.operator;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static com.blinc.xpos.TestJwtFactory.noRoleJwt;
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

/**
 * Integration test for Sales operator API: create sale, add line, add tender, complete, get
 * receipt. Requires Postgres (e.g. Testcontainers). Uses JWT mock with subject "admin" for operator
 * calls.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SaleOperatorControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void addLineWithModifiers() throws Exception {
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
    UUID modifierGroupId = createModifierGroup(orgId);
    UUID modifierOptionId = createModifierOption(orgId, modifierGroupId);
    addItemModifierGroup(orgId, itemId, modifierGroupId);

    String base =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/terminals/" + terminalId;

    MvcResult createSaleResult =
        mockMvc
            .perform(
                post(base + "/sales")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"priceListId\":\"" + priceListId + "\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    UUID saleId =
        UUID.fromString(
            objectMapper
                .readTree(createSaleResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    String addLineBody =
        """
        {"itemId":"%s","qty":1,"uomId":null,"unitPriceOverride":99.50,"modifiers":[{"modifierOptionId":"%s","qty":1}]}
        """
            .formatted(itemId, modifierOptionId);
    mockMvc
        .perform(
            post(base + "/sales/" + saleId + "/lines")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(addLineBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lines.length()").value(1))
        .andExpect(jsonPath("$.lines[0].modifiers").isArray())
        .andExpect(jsonPath("$.lines[0].modifiers.length()").value(1))
        .andExpect(
            jsonPath("$.lines[0].modifiers[0].modifierOptionId").value(modifierOptionId.toString()))
        .andExpect(jsonPath("$.lines[0].modifiers[0].qty").value(1));
  }

  /**
   * Tests POST .../sales/{saleId}/lines with exact request body from E2E_POSTMAN_GUIDE (step 13):
   * itemId, qty:1, uomId:null, unitPriceOverride:null, modifiers:[]
   */
  @Test
  void addLineWithExactGuideBody() throws Exception {
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

    String base =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/terminals/" + terminalId;

    MvcResult createSaleResult =
        mockMvc
            .perform(
                post(base + "/sales")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"priceListId\":\"" + priceListId + "\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    UUID saleId =
        UUID.fromString(
            objectMapper
                .readTree(createSaleResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    String addLineBody =
        """
        {"itemId":"%s","qty":1,"uomId":null,"unitPriceOverride":null,"modifiers":[]}
        """
            .formatted(itemId);
    mockMvc
        .perform(
            post(base + "/sales/" + saleId + "/lines")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(addLineBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lines.length()").value(1))
        .andExpect(jsonPath("$.lines[0].itemName").exists())
        .andExpect(jsonPath("$.lines[0].modifiers").isArray());
  }

  @Test
  void createSaleAddLineTenderCompleteAndGetReceipt() throws Exception {
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

    String base =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/terminals/" + terminalId;

    MvcResult createSaleResult =
        mockMvc
            .perform(
                post(base + "/sales")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"priceListId\":\"" + priceListId + "\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.status").value("OPEN"))
            .andExpect(jsonPath("$.total").value(0))
            .andReturn();
    UUID saleId =
        UUID.fromString(
            objectMapper
                .readTree(createSaleResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    String addLineBody =
        """
        {"itemId":"%s","qty":2,"unitPriceOverride":99.50}
        """.formatted(itemId);
    mockMvc
        .perform(
            post(base + "/sales/" + saleId + "/lines")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(addLineBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(199.0))
        .andExpect(jsonPath("$.lines.length()").value(1));

    String addTenderBody =
        """
        {"tenderTypeId":"%s","amount":200,"currency":"KES"}
        """
            .formatted(tenderTypeId);
    mockMvc
        .perform(
            post(base + "/sales/" + saleId + "/tenders")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(addTenderBody))
        .andExpect(status().isCreated());

    mockMvc
        .perform(post(base + "/sales/" + saleId + "/complete").with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("COMPLETED"))
        .andExpect(jsonPath("$.receiptId").exists());

    mockMvc
        .perform(get(base + "/sales/" + saleId + "/receipt").with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.receiptNumber").isNumber())
        .andExpect(jsonPath("$.businessDate").exists());
  }

  @Test
  void getReceiptDetailsReturnsAmountsLinesAndTendersAfterComplete() throws Exception {
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

    String base =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/terminals/" + terminalId;

    MvcResult createSaleResult =
        mockMvc
            .perform(
                post(base + "/sales")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"priceListId\":\"" + priceListId + "\"}"))
            .andExpect(status().isCreated())
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
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"itemId":"%s","qty":2,"uomId":null,"unitPriceOverride":99.50,"modifiers":[]}
                    """
                        .formatted(itemId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lines.length()").value(1))
        .andExpect(jsonPath("$.subtotal").value(199.0))
        .andExpect(jsonPath("$.total").value(199.0));

    mockMvc
        .perform(
            post(base + "/sales/" + saleId + "/tenders")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"tenderTypeId":"%s","amount":200,"currency":"KES"}
                    """
                        .formatted(tenderTypeId)))
        .andExpect(status().isCreated());

    mockMvc
        .perform(post(base + "/sales/" + saleId + "/complete").with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("COMPLETED"))
        .andExpect(jsonPath("$.receiptId").exists());

    mockMvc
        .perform(get(base + "/sales/" + saleId + "/receipt/details").with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").exists())
        .andExpect(jsonPath("$.receiptNumber").isNumber())
        .andExpect(jsonPath("$.businessDate").exists())
        .andExpect(jsonPath("$.subtotal").value(199.0))
        .andExpect(jsonPath("$.taxTotal").exists())
        .andExpect(jsonPath("$.discountTotal").exists())
        .andExpect(jsonPath("$.serviceChargeTotal").exists())
        .andExpect(jsonPath("$.total").value(199.0))
        .andExpect(jsonPath("$.amountTendered").value(200))
        .andExpect(jsonPath("$.changeDue").value(1.0))
        .andExpect(jsonPath("$.lines").isArray())
        .andExpect(jsonPath("$.lines.length()").value(1))
        .andExpect(jsonPath("$.lines[0].itemName").exists())
        .andExpect(jsonPath("$.lines[0].qty").value(2))
        .andExpect(jsonPath("$.lines[0].unitPrice").value(99.5))
        .andExpect(jsonPath("$.lines[0].lineTotal").value(199.0))
        .andExpect(jsonPath("$.taxLines").isArray())
        .andExpect(jsonPath("$.tenders").isArray())
        .andExpect(jsonPath("$.tenders.length()").value(1))
        .andExpect(jsonPath("$.tenders[0].tenderTypeCode").exists())
        .andExpect(jsonPath("$.tenders[0].amount").value(200))
        .andExpect(jsonPath("$.tenders[0].currency").value("KES"));
  }

  @Test
  void removeTenderFromOpenSale() throws Exception {
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

    String base =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/terminals/" + terminalId;

    MvcResult createSaleResult =
        mockMvc
            .perform(
                post(base + "/sales")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"priceListId\":\"" + priceListId + "\"}"))
            .andExpect(status().isCreated())
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
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    "{\"itemId\":\""
                        + itemId
                        + "\",\"qty\":1,\"uomId\":null,\"unitPriceOverride\":null}"))
        .andExpect(status().isOk());

    String addTenderBody =
        """
        {"tenderTypeId":"%s","amount":100,"currency":"KES"}
        """
            .formatted(tenderTypeId);
    mockMvc
        .perform(
            post(base + "/sales/" + saleId + "/tenders")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(addTenderBody))
        .andExpect(status().isCreated());

    MvcResult getSaleResult =
        mockMvc
            .perform(get(base + "/sales/" + saleId).with(operatorJwt()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.tenders.length()").value(1))
            .andReturn();
    UUID tenderId =
        UUID.fromString(
            objectMapper
                .readTree(getSaleResult.getResponse().getContentAsString())
                .get("tenders")
                .get(0)
                .get("id")
                .asText());

    mockMvc
        .perform(delete(base + "/sales/" + saleId + "/tenders/" + tenderId).with(operatorJwt()))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(get(base + "/sales/" + saleId).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.tenders").isArray())
        .andExpect(jsonPath("$.tenders.length()").value(0));
  }

  @Test
  void refundCompletedSaleReturnsRefundedStatus() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID terminalId = createTerminal(orgId, branchId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    openShift(orgId, branchId, terminalId);
    UUID supplierId = createSupplier(orgId);
    UUID priceListId = createPriceList(orgId);
    UUID itemId = createItemForRefundTest(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);
    addItemToPriceList(orgId, priceListId, itemId);
    UUID tenderTypeId = getCashTenderTypeId(orgId);

    String salesBase =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/terminals/" + terminalId;
    String receiptsBase = "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/receipts";

    MvcResult createSaleResult =
        mockMvc
            .perform(
                post(salesBase + "/sales")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"priceListId\":\"" + priceListId + "\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    UUID saleId =
        UUID.fromString(
            objectMapper
                .readTree(createSaleResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    mockMvc
        .perform(
            post(salesBase + "/sales/" + saleId + "/lines")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"itemId":"%s","qty":2,"uomId":null,"unitPriceOverride":99.50,"modifiers":[]}
                    """
                        .formatted(itemId)))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            post(salesBase + "/sales/" + saleId + "/tenders")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"tenderTypeId":"%s","amount":200,"currency":"KES"}
                    """
                        .formatted(tenderTypeId)))
        .andExpect(status().isCreated());

    mockMvc
        .perform(post(salesBase + "/sales/" + saleId + "/complete").with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("COMPLETED"));

    mockMvc
        .perform(post(receiptsBase + "/" + saleId + "/refund").with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(saleId.toString()))
        .andExpect(jsonPath("$.status").value("REFUNDED"));
  }

  /**
   * Completing a sale with a SALE_COMPLETE posting rule creates two ledger entries (debit and
   * credit) for the sale total.
   */
  @Test
  void completeSalePostsLedgerEntriesWhenPostingRuleExists() throws Exception {
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
    createLedgerAccount(orgId, "1000", "Cash", "ASSET");
    createLedgerAccount(orgId, "4000", "Sales", "INCOME");
    createPostingRule(orgId, "SALE_COMPLETE", "1000", "4000");

    String base =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/terminals/" + terminalId;

    MvcResult createSaleResult =
        mockMvc
            .perform(
                post(base + "/sales")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"priceListId\":\"" + priceListId + "\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    UUID saleId =
        UUID.fromString(
            objectMapper
                .readTree(createSaleResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    String addLineBody =
        """
        {"itemId":"%s","qty":2,"unitPriceOverride":99.50}
        """.formatted(itemId);
    mockMvc
        .perform(
            post(base + "/sales/" + saleId + "/lines")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(addLineBody))
        .andExpect(status().isOk());

    String addTenderBody =
        """
        {"tenderTypeId":"%s","amount":200,"currency":"KES"}
        """
            .formatted(tenderTypeId);
    mockMvc
        .perform(
            post(base + "/sales/" + saleId + "/tenders")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(addTenderBody))
        .andExpect(status().isCreated());

    mockMvc
        .perform(post(base + "/sales/" + saleId + "/complete").with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("COMPLETED"));

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/"
                    + orgId
                    + "/ledger-entries?branchId="
                    + branchId
                    + "&page=0&size=20")
                .with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(2))
        .andExpect(jsonPath("$.content[0].sourceType").value("SALE"))
        .andExpect(jsonPath("$.content[1].sourceType").value("SALE"))
        .andExpect(jsonPath("$.content[0].amount").value(199.0))
        .andExpect(jsonPath("$.content[1].amount").value(199.0));
  }

  @Test
  void completeWithDebtRecordsBalanceAsDebtAndCompletesSale() throws Exception {
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

    String base =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/terminals/" + terminalId;

    MvcResult createSaleResult =
        mockMvc
            .perform(
                post(base + "/sales")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"priceListId\":\"" + priceListId + "\"}"))
            .andExpect(status().isCreated())
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
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"itemId":"%s","qty":2,"unitPriceOverride":99.50}
                    """
                        .formatted(itemId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(199.0));

    mockMvc
        .perform(
            post(base + "/sales/" + saleId + "/tenders")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"tenderTypeId":"%s","amount":100,"currency":"KES"}
                    """
                        .formatted(tenderTypeId)))
        .andExpect(status().isCreated());

    String completeWithDebtBody =
        """
        {"customerName":"John Kamau","customerPhone":"+254700123456","dueDate":"2025-12-31"}
        """;
    mockMvc
        .perform(
            post(base + "/sales/" + saleId + "/complete-with-debt")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(completeWithDebtBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("COMPLETED"))
        .andExpect(jsonPath("$.receiptId").exists());

    mockMvc
        .perform(
            get("/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/debts")
                .with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.content[0].customerName").value("John Kamau"))
        .andExpect(jsonPath("$.content[0].amount").value(99.0))
        .andExpect(jsonPath("$.content[0].saleId").value(saleId.toString()));
  }

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
                .with(adminJwt())
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
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Test Org for Sales " + UUID.randomUUID()));
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
    String body = """
        {"legalName":"Test Business"}
        """;
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/businesses")
                    .with(adminJwt())
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
                    .with(adminJwt())
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
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createStaffUser(UUID orgId) throws Exception {
    String body = """
        {"iamUserId":"operator","username":"operator"}
        """;
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
    String body = """
        {"branchId":"%s","primary":true}
        """.formatted(branchId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/staff-users/" + staffUserId + "/branches")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
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
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"openingFloatAmount\":0}"))
        .andExpect(status().isCreated());
  }

  private UUID createPriceList(UUID orgId) throws Exception {
    String body = """
        {"name":"Default","priority":0,"active":true}
        """;
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-lists")
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
        {"name":"Test Product","itemType":"STOCK","taxProfileId":"%s","trackInventory":false,"active":true}
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
    String body =
        """
        {"name":"VAT Standard","vatCategory":"STANDARD","serviceChargeRate":0,"levyRate":0}
        """;
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/tax-profiles")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private void addItemToPriceList(UUID orgId, UUID priceListId, UUID itemId) throws Exception {
    String body =
        """
        {"itemId":"%s","price":99.50,"currency":"KES"}
        """.formatted(itemId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/price-lists/" + priceListId + "/items")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }

  private UUID createSupplier(UUID orgId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/suppliers")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"name\":\"Supplier\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createItemForRefundTest(UUID orgId) throws Exception {
    UUID taxProfileId = createTaxProfile(orgId);
    String body =
        """
        {"name":"Test Product","itemType":"STOCK","taxProfileId":"%s","trackInventory":true,"active":true}
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
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }

  /**
   * Orgs get a CASH tender type auto-created on creation (OrgServiceImpl). Fetch it instead of
   * creating to avoid 409 conflict.
   */
  private UUID getCashTenderTypeId(UUID orgId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(get("/api/v1/admin/orgs/" + orgId + "/tender-types").with(adminJwt()))
            .andExpect(status().isOk())
            .andReturn();
    var tree = objectMapper.readTree(result.getResponse().getContentAsString());
    var list = tree.isArray() ? tree : tree.get("content");
    if (list == null) {
      throw new IllegalStateException("No tender types returned for org " + orgId);
    }
    for (var el : list) {
      if ("CASH".equals(el.get("code").asText())) {
        return UUID.fromString(el.get("id").asText());
      }
    }
    throw new IllegalStateException("CASH tender type not found for org " + orgId);
  }

  private UUID createModifierGroup(UUID orgId) throws Exception {
    String body =
        """
        {"name":"Size","minSelect":0,"maxSelect":2,"required":false}
        """;
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/modifier-groups")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createModifierOption(UUID orgId, UUID modifierGroupId) throws Exception {
    String body = """
        {"name":"Large","priceDelta":50}
        """;
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/"
                        + orgId
                        + "/modifier-groups/"
                        + modifierGroupId
                        + "/options")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private void addItemModifierGroup(UUID orgId, UUID itemId, UUID modifierGroupId)
      throws Exception {
    String body = """
        {"modifierGroupId":"%s"}
        """.formatted(modifierGroupId);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/items/" + itemId + "/modifier-groups")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }

  @Test
  void operatorEndpointForbiddenForNoRole() throws Exception {
    UUID fakeOrgId = UUID.randomUUID();
    UUID fakeBranchId = UUID.randomUUID();
    UUID fakeTerminalId = UUID.randomUUID();
    mockMvc
        .perform(
            get("/api/v1/operator/orgs/"
                    + fakeOrgId
                    + "/branches/"
                    + fakeBranchId
                    + "/terminals/"
                    + fakeTerminalId
                    + "/sales")
                .with(noRoleJwt()))
        .andExpect(status().isForbidden());
  }
}
