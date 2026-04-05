package com.blinc.xpos.api.v1.admin.pricing;

import static com.blinc.xpos.TestJwtFactory.adminJwt;
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

@SpringBootTest
@AutoConfigureMockMvc
class ScheduledPriceAdminControllerIT extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void addListGetAndRemoveScheduledPrice() throws Exception {
    UUID orgId = createOrg();
    UUID branchId = createBranch(orgId);
    UUID staffUserId = createStaffUser(orgId);
    assignStaffToBranch(orgId, staffUserId, branchId);
    UUID supplierId = createSupplier(orgId);
    UUID priceScheduleId = createPriceSchedule(orgId, branchId);
    UUID itemId = createItem(orgId);

    String grnBody =
        "{\"branchId\":\""
            + branchId
            + "\",\"supplierId\":\""
            + supplierId
            + "\",\"lines\":[{\"itemId\":\""
            + itemId
            + "\",\"qty\":5,\"receivedUnitCost\":80.00}]}";
    mockMvc
        .perform(
            post("/api/v1/admin/orgs/" + orgId + "/goods-receipt-notes")
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content(grnBody))
        .andExpect(status().isCreated());

    String addBody =
        """
        {"itemId":"%s","price":99.99,"currency":"KES"}
        """.formatted(itemId);

    MvcResult addResult =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/"
                        + orgId
                        + "/price-schedules/"
                        + priceScheduleId
                        + "/prices")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(addBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.itemId").value(itemId.toString()))
            .andExpect(jsonPath("$.price").value(99.99))
            .andReturn();

    UUID scheduledPriceId =
        UUID.fromString(
            objectMapper.readTree(addResult.getResponse().getContentAsString()).get("id").asText());

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/" + orgId + "/price-schedules/" + priceScheduleId + "/prices")
                .with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1));

    mockMvc
        .perform(
            get("/api/v1/admin/orgs/"
                    + orgId
                    + "/price-schedules/"
                    + priceScheduleId
                    + "/prices/"
                    + scheduledPriceId)
                .with(adminJwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.price").value(99.99));

    mockMvc
        .perform(
            delete(
                    "/api/v1/admin/orgs/"
                        + orgId
                        + "/price-schedules/"
                        + priceScheduleId
                        + "/prices/"
                        + scheduledPriceId)
                .with(adminJwt()))
        .andExpect(status().isNoContent());
  }

  private UUID createOrg() throws Exception {
    String body =
        objectMapper.writeValueAsString(
            new OrgCreateRequest("Test Org ScheduledPrice " + UUID.randomUUID()));
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

  private UUID createStaffUser(UUID orgId) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/staff-users")
                    .with(adminJwt())
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
                .with(adminJwt())
                .contentType(APPLICATION_JSON)
                .content("{\"branchId\":\"" + branchId + "\",\"primary\":true}"))
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

  private UUID createPriceSchedule(UUID orgId, UUID branchId) throws Exception {
    String body =
        """
        {"branchId":"%s","name":"Schedule A","startsAt":"09:00","endsAt":"18:00","daysOfWeek":127}
        """
            .formatted(branchId);
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/price-schedules")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createItem(UUID orgId) throws Exception {
    UUID categoryId = createCategory(orgId);
    UUID uomId = createUom(orgId);
    UUID taxProfileId = createTaxProfile(orgId);
    String body =
        ("{\"sku\":\"SKU-1\",\"name\":\"Item One\",\"itemType\":\"STOCK\",\"categoryId\":\"%s\","
                + "\"baseUomId\":\"%s\",\"taxProfileId\":\"%s\",\"trackInventory\":false,"
                + "\"active\":true}")
            .formatted(categoryId, uomId, taxProfileId);
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

  private UUID createCategory(UUID orgId) throws Exception {
    String body = """
        {"name":"Cat","type":"PRODUCT"}
        """;
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/categories")
                    .with(adminJwt())
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }

  private UUID createUom(UUID orgId) throws Exception {
    String body = """
        {"name":"Unit","symbol":"u"}
        """;
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/admin/orgs/" + orgId + "/uoms")
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
        {"name":"VAT","vatCategory":"STANDARD","serviceChargeRate":0,"levyRate":0}
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
}
