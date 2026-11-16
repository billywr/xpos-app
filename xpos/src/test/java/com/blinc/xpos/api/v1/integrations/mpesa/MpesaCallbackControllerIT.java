package com.blinc.xpos.api.v1.integrations.mpesa;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static com.blinc.xpos.TestJwtFactory.operatorJwt;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.blinc.xpos.AbstractIntegrationTest;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgCreateRequest;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgResponse;
import com.blinc.xpos.modules.mpesa.client.DarajaClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class MpesaCallbackControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @MockitoBean private DarajaClient darajaClient;

  @Test
  void successCallbackCreatesTenderAndIsIdempotent() throws Exception {
    SaleContext ctx = createOpenSaleWithStk("checkout-cb-" + UUID.randomUUID(), false);
    int kesAmount = (int) Math.round(ctx.saleTotal());
    String callback =
        """
        {
          "Body": {
            "stkCallback": {
              "MerchantRequestID": "merchant-cb",
              "CheckoutRequestID": "%s",
              "ResultCode": 0,
              "ResultDesc": "The service request is processed successfully.",
              "CallbackMetadata": {
                "Item": [
                  {"Name":"Amount","Value":%d},
                  {"Name":"MpesaReceiptNumber","Value":"QAB123XYZ"}
                ]
              }
            }
          }
        }
        """
            .formatted(ctx.checkoutId(), kesAmount);

    mockMvc
        .perform(
            post("/api/v1/integrations/mpesa/stk/callback")
                .contentType(APPLICATION_JSON)
                .content(callback))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            get(ctx.base + "/sales/" + ctx.saleId + "/mpesa/stk/" + ctx.stkId).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("SUCCESS"))
        .andExpect(jsonPath("$.tenderId").exists());

    mockMvc
        .perform(get(ctx.base + "/sales/" + ctx.saleId).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.tenders.length()").value(1));

    mockMvc
        .perform(
            post("/api/v1/integrations/mpesa/stk/callback")
                .contentType(APPLICATION_JSON)
                .content(callback))
        .andExpect(status().isOk());

    mockMvc
        .perform(get(ctx.base + "/sales/" + ctx.saleId).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.tenders.length()").value(1));
  }

  @Test
  void autoCompleteCompletesSaleWhenEnabled() throws Exception {
    SaleContext ctx = createOpenSaleWithStk("checkout-auto-" + UUID.randomUUID(), true);
    int kesAmount = (int) Math.round(ctx.saleTotal());
    String callback =
        """
        {
          "Body": {
            "stkCallback": {
              "MerchantRequestID": "merchant-auto",
              "CheckoutRequestID": "%s",
              "ResultCode": 0,
              "ResultDesc": "Success",
              "CallbackMetadata": {
                "Item": [
                  {"Name":"Amount","Value":%d},
                  {"Name":"MpesaReceiptNumber","Value":"RCE456ABC"}
                ]
              }
            }
          }
        }
        """
            .formatted(ctx.checkoutId(), kesAmount);

    mockMvc
        .perform(
            post("/api/v1/integrations/mpesa/stk/callback")
                .contentType(APPLICATION_JSON)
                .content(callback))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            get(ctx.base + "/sales/" + ctx.saleId + "/mpesa/stk/" + ctx.stkId).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.saleCompleted").value(true));

    mockMvc
        .perform(get(ctx.base + "/sales/" + ctx.saleId).with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("COMPLETED"));
  }

  private SaleContext createOpenSaleWithStk(String checkoutId, boolean autoComplete)
      throws Exception {
    String merchantId = "merchant-" + checkoutId;
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID terminalId = createTerminal(orgId, branchId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    openShift(orgId, branchId, terminalId);
    createMpesaConfig(orgId, autoComplete);
    enableStkOperator(orgId);
    UUID supplierId = createSupplier(orgId);
    UUID itemId = createItem(orgId);
    createGrnForItem(orgId, branchId, supplierId, itemId);

    when(darajaClient.initiateStkPush(any(), anyString(), anyString(), any(), anyString()))
        .thenReturn(
            new DarajaClient.DarajaStkPushResult(
                merchantId, checkoutId, "0", "Success. Request accepted"));

    String base =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/terminals/" + terminalId;
    MvcResult createSaleResult =
        mockMvc
            .perform(
                post(base + "/sales")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{}"))
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
        {"itemId":"%s","qty":1,"unitPriceOverride":100.00}
        """
            .formatted(itemId);
    mockMvc
        .perform(
            post(base + "/sales/" + saleId + "/lines")
                .with(operatorJwt())
                .contentType(APPLICATION_JSON)
                .content(addLineBody))
        .andExpect(status().isOk());

    MvcResult saleResult =
        mockMvc.perform(get(base + "/sales/" + saleId).with(operatorJwt())).andReturn();
    double saleTotal =
        objectMapper
            .readTree(saleResult.getResponse().getContentAsString())
            .get("total")
            .asDouble();

    MvcResult stkResult =
        mockMvc
            .perform(
                post(base + "/sales/" + saleId + "/mpesa/stk")
                    .with(operatorJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"phoneNumber\":\"0712345678\",\"amount\":" + saleTotal + "}"))
            .andExpect(status().isCreated())
            .andReturn();
    UUID stkId =
        UUID.fromString(
            objectMapper.readTree(stkResult.getResponse().getContentAsString()).get("id").asText());
    return new SaleContext(base, saleId, stkId, checkoutId, saleTotal);
  }

  private void createMpesaConfig(UUID orgId, boolean autoComplete) throws Exception {
    String body =
        """
        {
          "environment":"SANDBOX",
          "consumerKey":"k",
          "consumerSecret":"s",
          "passkey":"p",
          "shortcode":"174379",
          "stkAutoComplete":%s
        }
        """
            .formatted(autoComplete);
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/mpesa/configs")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }

  private void enableStkOperator(UUID orgId) throws Exception {
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/mpesa/operator-settings")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"stkOperatorEnabled\":true}"))
        .andExpect(status().isOk());
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Mpesa Callback Org " + UUID.randomUUID()));
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

  private UUID createItem(UUID orgId) throws Exception {
    UUID taxProfileId = createTaxProfile(orgId);
    String body =
        """
        {"name":"Test Product","itemType":"STOCK","taxProfileId":"%s",\
        "trackInventory":false,"active":true,\
        "buyingPrice":80.00,"defaultSellingPrice":100.00,"visibleInPos":true}
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
                        "{\"name\":\"VAT Standard\",\"vatCategory\":\"STANDARD\","
                            + "\"serviceChargeRate\":0,\"levyRate\":0}"))
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

  private record SaleContext(
      String base, UUID saleId, UUID stkId, String checkoutId, double saleTotal) {}
}
