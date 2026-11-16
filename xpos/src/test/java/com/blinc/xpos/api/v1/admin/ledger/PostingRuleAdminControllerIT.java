package com.blinc.xpos.api.v1.admin.ledger;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static org.springframework.http.MediaType.APPLICATION_JSON;
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
class PostingRuleAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void createThenGetAndListPostingRules() throws Exception {
    UUID orgId = createOrg();
    createLedgerAccount(orgId, "4000", "Sales", "INCOME");
    createLedgerAccount(orgId, "1000", "Cash", "ASSET");
    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/posting-rules")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(
                        "{\"eventType\":\"SALE_COMPLETED\",\"debitAccountCode\":\"1000\","
                            + "\"creditAccountCode\":\"4000\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.eventType").value("SALE_COMPLETED"))
            .andReturn();
    UUID ruleId =
        UUID.fromString(
            objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .get("id")
                .asText());
    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId + "/posting-rules/" + ruleId).with(adminJwt()))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/posting-rules?page=0&size=10").with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1));
  }

  private void createLedgerAccount(UUID orgId, String code, String name, String type)
      throws Exception {
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/ledger-accounts")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    "{\"code\":\""
                        + code
                        + "\",\"name\":\""
                        + name
                        + "\",\"accountType\":\""
                        + type
                        + "\"}"))
        .andExpect(status().isCreated());
  }

  private UUID createOrg() throws Exception {
    String body = objectMapper.writeValueAsString(new OrgCreateRequest("Test Org PostingRules"));
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
}
