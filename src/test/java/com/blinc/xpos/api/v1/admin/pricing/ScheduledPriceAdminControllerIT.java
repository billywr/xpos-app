package com.blinc.xpos.api.v1.admin.pricing;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
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
    UUID priceScheduleId = createPriceSchedule(orgId, branchId);
    UUID itemId = createItem(orgId);

    String addBody =
        """
        {"itemId":"%s","price":99.99,"currency":"KES"}
        """
            .formatted(itemId);

    MvcResult addResult =
        mockMvc
            .perform(
                post(
                        "/api/v1/admin/orgs/"
                            + orgId
                            + "/price-schedules/"
                            + priceScheduleId
                            + "/prices")
                    .with(user("admin").roles("ADMIN"))
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
            get(
                    "/api/v1/admin/orgs/"
                        + orgId
                        + "/price-schedules/"
                        + priceScheduleId
                        + "/prices")
                .with(user("admin").roles("ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1));

    mockMvc
        .perform(
            get(
                    "/api/v1/admin/orgs/"
                        + orgId
                        + "/price-schedules/"
                        + priceScheduleId
                        + "/prices/"
                        + scheduledPriceId)
                .with(user("admin").roles("ADMIN")))
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
                .with(user("admin").roles("ADMIN")))
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
                    .with(user("admin").roles("ADMIN"))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return objectMapper.readValue(result.getResponse().getContentAsString(), OrgResponse.class).id();
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
                    .with(user("admin").roles("ADMIN"))
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
                    .with(user("admin").roles("ADMIN"))
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
                    .with(user("admin").roles("ADMIN"))
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
                    .with(user("admin").roles("ADMIN"))
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
                    .with(user("admin").roles("ADMIN"))
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
                    .with(user("admin").roles("ADMIN"))
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
                    .with(user("admin").roles("ADMIN"))
                    .contentType(APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn();
    return UUID.fromString(
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
  }
}
