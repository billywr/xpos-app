package com.blinc.xpos.api.v1.operator;

import static com.blinc.xpos.TestJwtFactory.operatorJwt;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.blinc.xpos.AbstractIntegrationTest;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgCreateRequest;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgResponse;
import com.blinc.xpos.modules.assistant.InsightType;
import com.blinc.xpos.modules.assistant.service.InsightEventService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class InsightOperatorControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private InsightEventService insightEventService;

  @Test
  void listAndAcknowledgeInsight() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);

    ObjectNode data = objectMapper.createObjectNode();
    data.put("count", 2);
    insightEventService.create(
        orgId,
        branchId,
        InsightType.LOW_STOCK,
        "WARN",
        "2 item(s) at or below reorder point",
        "Review restock list.",
        data);

    String base =
        "/api/v1/operator/orgs/" + orgId + "/branches/" + branchId + "/assistant/insights";

    mockMvc
        .perform(get(base + "/count").with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.unacknowledged").value(1));

    MvcResult listResult =
        mockMvc
            .perform(get(base).with(operatorJwt()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].title").isString())
            .andReturn();

    String insightId =
        objectMapper
            .readTree(listResult.getResponse().getContentAsString())
            .get("content")
            .get(0)
            .get("id")
            .asText();

    mockMvc
        .perform(post(base + "/" + insightId + "/acknowledge").with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.acknowledgedAt").isNotEmpty());

    mockMvc
        .perform(get(base + "/count").with(operatorJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.unacknowledged").value(0));
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(new OrgCreateRequest("Insight Org " + UUID.randomUUID()));
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs")
                    .with(com.blinc.xpos.TestJwtFactory.adminJwt())
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
                    .with(com.blinc.xpos.TestJwtFactory.adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"legalName\":\"Biz\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createBranch(UUID orgId, UUID businessId) throws Exception {
    String body =
        "{\"businessId\":\""
            + businessId
            + "\",\"name\":\"B1\","
            + "\"timezone\":\"Africa/Nairobi\",\"currency\":\"KES\"}";
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/branches")
                    .with(com.blinc.xpos.TestJwtFactory.adminJwt())
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
                    .with(com.blinc.xpos.TestJwtFactory.adminJwt())
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
                .with(com.blinc.xpos.TestJwtFactory.adminJwt())
                .contentType(APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }
}
