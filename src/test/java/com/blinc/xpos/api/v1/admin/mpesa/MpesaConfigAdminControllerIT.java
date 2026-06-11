package com.blinc.xpos.api.v1.admin.mpesa;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
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
class MpesaConfigAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @MockitoBean private DarajaClient darajaClient;

  @Test
  void createOrgDefaultAndList() throws Exception {
    UUID orgId = createOrg();
    String body =
        """
        {
          "environment":"SANDBOX",
          "consumerKey":"test-key",
          "consumerSecret":"test-secret",
          "passkey":"test-passkey",
          "shortcode":"174379",
          "stkAutoComplete":true
        }
        """;
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/mpesa/configs")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.consumerSecretMasked").value("****cret"))
        .andExpect(jsonPath("$.stkAutoComplete").value(true));

    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId + "/mpesa/configs").with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].shortcode").value("174379"));
  }

  @Test
  void createOrgDefaultWithoutPasskeyInSandbox() throws Exception {
    UUID orgId = createOrg();
    String body =
        """
        {
          "environment":"SANDBOX",
          "consumerKey":"test-key",
          "consumerSecret":"test-secret",
          "shortcode":"174379",
          "stkAutoComplete":false
        }
        """;
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/mpesa/configs")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.passkeyMasked").value("(sandbox default)"));
  }

  @Test
  void duplicateOrgDefaultReturns409() throws Exception {
    UUID orgId = createOrg();
    String body =
        """
        {
          "environment":"SANDBOX",
          "consumerKey":"k",
          "consumerSecret":"s",
          "passkey":"p",
          "shortcode":"174379",
          "stkAutoComplete":false
        }
        """;
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/mpesa/configs")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/mpesa/configs")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("MPESA_CONFIG_EXISTS"));
  }

  @Test
  void branchOverrideAndUpdate() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);

    String orgBody =
        """
        {
          "environment":"SANDBOX",
          "consumerKey":"org-key",
          "consumerSecret":"org-secret",
          "passkey":"org-pass",
          "shortcode":"600000",
          "stkAutoComplete":false
        }
        """;
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/mpesa/configs")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(orgBody))
        .andExpect(status().isCreated());

    String branchBody =
        """
        {
          "environment":"SANDBOX",
          "consumerKey":"branch-key",
          "consumerSecret":"branch-secret",
          "passkey":"branch-pass",
          "shortcode":"174379",
          "stkAutoComplete":true
        }
        """;
    MvcResult branchResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/mpesa/configs/branches/" + branchId)
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(branchBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.branchId").value(branchId.toString()))
            .andReturn();
    UUID configId =
        UUID.fromString(
            objectMapper
                .readTree(branchResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/mpesa/configs/" + configId)
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"stkAutoComplete\":false}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.stkAutoComplete").value(false));
  }

  @Test
  void verifyDarajaConnection() throws Exception {
    UUID orgId = createOrg();
    String body =
        """
        {
          "environment":"SANDBOX",
          "consumerKey":"test-key",
          "consumerSecret":"test-secret",
          "shortcode":"174379",
          "stkAutoComplete":false
        }
        """;
    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/mpesa/configs")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    UUID configId =
        UUID.fromString(
            objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    doNothing().when(darajaClient).verifyOAuth(any());

    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/mpesa/configs/" + configId + "/verify")
                .with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ok").value(true))
        .andExpect(jsonPath("$.environment").value("SANDBOX"));

    verify(darajaClient).verifyOAuth(any());
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Mpesa Test Org " + UUID.randomUUID()));
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
                    .content("{\"legalName\":\"Test Business\"}"))
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
}
