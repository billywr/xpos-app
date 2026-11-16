package com.blinc.xpos.api.v1.admin.pricing;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
class PromotionRuleAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void createListGetAndUpdatePromotionRule() throws Exception {
    UUID orgId = createOrg();
    UUID branchId = createBranch(orgId);
    String createBody =
        ("{\"branchId\":\"%s\",\"name\":\"Weekend Discount\",\"ruleType\":\"DISCOUNT\","
                + "\"conditionsJson\":\"{}\",\"actionsJson\":\"{\\\"discountPercent\\\":10}\","
                + "\"priority\":1,\"active\":true}")
            .formatted(branchId);

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/promotion-rules")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(createBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.name").value("Weekend Discount"))
            .andExpect(jsonPath("$.ruleType").value("DISCOUNT"))
            .andReturn();

    String createJson = createResult.getResponse().getContentAsString();
    UUID ruleId = UUID.fromString(objectMapper.readTree(createJson).get("id").asText());

    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId + "/promotion-rules").with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1));

    mockMvc
        .perform(get("/api/v1/admin/orgs/" + orgId + "/promotion-rules/" + ruleId).with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Weekend Discount"));

    String updateBody =
        "{\"name\":\"Weekend Sale\",\"ruleType\":\"DISCOUNT\",\"conditionsJson\":\"{}\","
            + "\"actionsJson\":\"{\\\"discountPercent\\\":15}\",\"priority\":2,\"active\":false}";
    mockMvc
        .perform(
            patch("/api/v1/admin/orgs/" + orgId + "/promotion-rules/" + ruleId)
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(updateBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Weekend Sale"))
        .andExpect(jsonPath("$.active").value(false));
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Test Org PromotionRule " + UUID.randomUUID()));
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

  private UUID createBranch(UUID orgId) throws Exception {
    UUID businessId = createBusiness(orgId);
    String body =
        """
        {"businessId":"%s","name":"Main","timezone":"Africa/Nairobi","currency":"KES"}
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

  private UUID createBusiness(UUID orgId) throws Exception {
    String body = """
        {"legalName":"Biz One"}
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
}
