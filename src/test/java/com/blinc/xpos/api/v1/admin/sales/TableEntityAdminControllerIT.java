package com.blinc.xpos.api.v1.admin.sales;

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
class TableEntityAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void createTableWithoutAreaListAndUpdate() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);

    String base = "/api/v1/admin/orgs/" + orgId + "/branches/" + branchId + "/tables";

    MvcResult createResult =
        mockMvc
            .perform(
                post(base)
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"tableAreaId\":null,\"name\":\"A-1\",\"capacity\":4}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.name").value("A-1"))
            .andExpect(jsonPath("$.capacity").value(4))
            .andExpect(jsonPath("$.status").exists())
            .andReturn();
    UUID tableId =
        UUID.fromString(
            objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .get("id")
                .asText());

    mockMvc
        .perform(get(base + "?page=0&size=10").with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.content[0].name").value("A-1"));

    mockMvc
        .perform(get(base + "/" + tableId).with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(tableId.toString()))
        .andExpect(jsonPath("$.name").value("A-1"));

    mockMvc
        .perform(
            patch(base + "/" + tableId)
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"tableAreaId":null,"name":"A-1 Updated","capacity":6,"status":"ACTIVE"}
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("A-1 Updated"))
        .andExpect(jsonPath("$.capacity").value(6));
  }

  @Test
  void createTableWithArea() throws Exception {
    UUID orgId = createOrg();
    UUID businessId = createBusiness(orgId);
    UUID branchId = createBranch(orgId, businessId);
    UUID areaId = createTableArea(orgId, branchId);

    String base = "/api/v1/admin/orgs/" + orgId + "/branches/" + branchId + "/tables";

    mockMvc
        .perform(
            post(base)
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(
                    """
                    {"tableAreaId":"%s","name":"T1","capacity":2}
                    """
                        .formatted(areaId)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.tableAreaId").value(areaId.toString()))
        .andExpect(jsonPath("$.name").value("T1"))
        .andExpect(jsonPath("$.capacity").value(2));
  }

  private UUID createTableArea(UUID orgId, UUID branchId) throws Exception {
    String url = "/api/v1/admin/orgs/" + orgId + "/branches/" + branchId + "/table-areas";
    MvcResult result =
        mockMvc
            .perform(
                post(url)
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content("{\"name\":\"Patio\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createOrg() throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            new OrgCreateRequest("TableEntity Test " + UUID.randomUUID()))))
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
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/branches")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(
                        """
                        {"businessId":"%s","name":"Main","timezone":"Africa/Nairobi","currency":"KES"}
                        """
                            .formatted(businessId)))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }
}
